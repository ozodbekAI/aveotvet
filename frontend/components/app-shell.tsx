"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import Sidebar from "@/components/layout/sidebar"
import { ShopProvider } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createShop, listShops, getMe } from "@/lib/api"
import { clearAuthToken } from "@/lib/auth"
import { LogOut, RefreshCw } from "lucide-react"

type Shop = { id: number; name: string }

const SELECTED_SHOP_KEY = "wb_otveto_selected_shop_id"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  const [loadingShops, setLoadingShops] = useState(false)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Add shop dialog
  const [addOpen, setAddOpen] = useState(false)
  const [newShopName, setNewShopName] = useState("")
  const [newShopToken, setNewShopToken] = useState("")
  const [creatingShop, setCreatingShop] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const selectedShop = useMemo(() => shops.find((s) => s.id === selectedShopId) || null, [shops, selectedShopId])

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_SHOP_KEY) : null
    const savedId = saved ? Number.parseInt(saved, 10) : null
    if (savedId && Number.isFinite(savedId)) {
      setSelectedShopId(savedId)
    }
  }, [])

  useEffect(() => {
    if (selectedShopId && typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_SHOP_KEY, String(selectedShopId))
    }
  }, [selectedShopId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Load current user role (optional). If backend is down/unauthorized, ignore.
        try {
          const me = await getMe()
          if (mounted) setIsSuperAdmin(me?.role === "super_admin")
        } catch {
          // ignore
        }
        setLoadingShops(true)
        const data = await listShops()
        if (!mounted) return
        setShops(data)

        // If no shop selected, select first.
        if (!selectedShopId && data.length) {
          setSelectedShopId(data[0].id)
        }
        // If selected shop was deleted, fallback.
        if (selectedShopId && !data.some((s) => s.id === selectedShopId)) {
          setSelectedShopId(data.length ? data[0].id : null)
        }
      } catch {
        // If unauthorized or backend down, redirect to login.
        // The server-side layout guard will also handle missing cookies.
      } finally {
        if (mounted) setLoadingShops(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedShopId])

  const handleShopChange = (shopId: number) => {
    setSelectedShopId(shopId)
    router.refresh()
  }

  const handleLogout = () => {
    clearAuthToken()
    router.push("/login")
    router.refresh()
  }

  const handleCreateShop = async () => {
    setCreateError(null)
    if (!newShopName.trim()) {
      setCreateError("Укажите название магазина")
      return
    }
    if (!newShopToken.trim()) {
      setCreateError("Укажите токен WB")
      return
    }

    try {
      setCreatingShop(true)
      const created = await createShop({ name: newShopName.trim(), wb_token: newShopToken.trim() })
      const updated = await listShops()
      setShops(updated)
      setSelectedShopId(created.id)
      setNewShopName("")
      setNewShopToken("")
      setAddOpen(false)
      router.refresh()
    } catch (e: any) {
      setCreateError(e?.message || "Не удалось создать магазин")
    } finally {
      setCreatingShop(false)
    }
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        shops={shops}
        selectedShopId={selectedShopId}
        onShopChange={handleShopChange}
        onAddShop={() => setAddOpen(true)}
        isSuperAdmin={isSuperAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Текущий магазин
              </div>
              <div className="font-semibold text-foreground truncate text-lg">
                {loadingShops ? "Загрузка…" : selectedShop?.name || "Магазин не выбран"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.refresh()}
                className="border-border text-foreground hover:bg-secondary"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить
              </Button>
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="bg-destructive/20 text-destructive hover:bg-destructive/30"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </header>

        <ShopProvider value={{ shopId: selectedShopId, setShopId: setSelectedShopId }}>
          <main className="flex-1 overflow-auto p-6">
            {/* Pages rely on shop_id; enforce selection early */}
            {!selectedShopId ? (
              <div className="max-w-xl">
                <div className="text-2xl font-bold text-foreground mb-2">Магазины отсутствуют</div>
                <div className="text-sm text-muted-foreground mb-4">
                  Создайте магазин и добавьте токен Wildberries, чтобы начать синхронизацию отзывов, вопросов и чатов.
                </div>
                <Button onClick={() => setAddOpen(true)} className="bg-primary hover:bg-primary/90">
                  Создать первый магазин
                </Button>
              </div>
            ) : (
              <>{children}</>
            )}
          </main>
        </ShopProvider>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Добавить магазин</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shop_name" className="text-foreground">
                Название
              </Label>
              <Input
                id="shop_name"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="Мой магазин WB"
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label htmlFor="wb_token" className="text-foreground">
                WB токен
              </Label>
              <Input
                id="wb_token"
                value={newShopToken}
                onChange={(e) => setNewShopToken(e.target.value)}
                placeholder="..."
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Хранится в backend и используется для синхронизации отзывов, вопросов и чатов.
              </div>
            </div>

            {createError ? <div className="text-sm text-destructive">{createError}</div> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={creatingShop}
              className="border-border text-foreground hover:bg-secondary"
            >
              Отмена
            </Button>
            <Button onClick={handleCreateShop} disabled={creatingShop} className="bg-primary hover:bg-primary/90">
              {creatingShop ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
