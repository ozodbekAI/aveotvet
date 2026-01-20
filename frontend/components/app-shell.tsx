"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import Sidebar from "@/components/layout/sidebar"
import { ShopProvider } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import CreateShopDialog from "@/components/create-shop-dialog"

import { getBillingShop, listShops, getMe, type ShopOut, type ShopBilling } from "@/lib/api"
import { clearAuthToken } from "@/lib/auth"
import { LogOut, RefreshCw } from "lucide-react"

const SELECTED_SHOP_KEY = "wb_otveto_selected_shop_id"

function roleLabel(role?: string) {
  switch (role) {
    case "owner":
      return "Владелец"
    case "manager":
      return "Менеджер"
    default:
      return role || "—"
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const [shops, setShops] = useState<ShopOut[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  const [loadingShops, setLoadingShops] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [me, setMe] = useState<{ id: number; email: string; role: string } | null>(null)

  const [shopBilling, setShopBilling] = useState<ShopBilling | null>(null)
  const [shopBalanceLoading, setShopBalanceLoading] = useState(false)

  const selectedShop = useMemo(() => shops.find((s) => s.id === selectedShopId) || null, [shops, selectedShopId])
  const selectedShopRole = useMemo(() => (selectedShop?.my_role as any) || null, [selectedShop])

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

  const refresh = useCallback(async () => {
    // Load current user info + shops list.
    setLoadingShops(true)
    try {
      try {
        const meData = await getMe()
        setMe(meData)
      } catch {
        setMe(null)
      }

      const data = await listShops()
      setShops(data || [])

      // If no shop selected, select first.
      if (!selectedShopId && data?.length) {
        setSelectedShopId(data[0].id)
      }
      // If selected shop was deleted, fallback.
      if (selectedShopId && data && !data.some((s) => s.id === selectedShopId)) {
        setSelectedShopId(data.length ? data[0].id : null)
      }
    } finally {
      setLoadingShops(false)
    }
  }, [selectedShopId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await refresh()
      } catch {
        // ignore
      } finally {
        if (!mounted) return
      }
    })()
    return () => {
      mounted = false
    }
  }, [refresh])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) {
        if (mounted) setShopBilling(null)
        return
      }

      const role = shops.find((s) => s.id === selectedShopId)?.my_role
      // TZ: store billing is owner-only.
      const canSee = role === "owner"
      if (!canSee) {
        if (mounted) setShopBilling(null)
        return
      }

      try {
        if (mounted) setShopBalanceLoading(true)
        const b = await getBillingShop(selectedShopId)
        if (mounted) setShopBilling(b || null)
      } catch {
        if (mounted) setShopBilling(null)
      } finally {
        if (mounted) setShopBalanceLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedShopId, shops])

  const handleShopChange = (shopId: number) => {
    setSelectedShopId(shopId)
    router.refresh()
  }

  const handleCreated = async (shop: ShopOut) => {
    // Refresh list and select newly created shop.
    await refresh()
    setSelectedShopId(shop.id)
    router.refresh()
  }

  const handleLogout = () => {
    clearAuthToken()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        shops={shops}
        selectedShopId={selectedShopId}
        onShopChange={handleShopChange}
        selectedShopRole={selectedShopRole}
        shopBilling={shopBilling}
        shopBillingLoading={shopBalanceLoading}
        canCreateShop={true}
        onAddShop={() => setCreateOpen(true)}
      />

      <CreateShopDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Текущий магазин</div>
              <div className="font-semibold text-foreground truncate text-lg">
                {loadingShops ? "Загрузка…" : selectedShop?.name || "Магазин не выбран"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={refresh} className="border-border text-foreground hover:bg-secondary">
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

        <ShopProvider
          value={{
            shopId: selectedShopId,
            setShopId: setSelectedShopId,
            shops,
            selectedShop,
            shopRole: selectedShopRole,
            me,
            isSuperAdmin: false,
            billing: shopBilling,
            refresh,
          }}
        >
          {/*
            IMPORTANT: the app scroll container is inside <main>, not the <body>.
            Some modal libraries lock <body> scrolling only; we use this id to
            reliably lock background scroll when dialogs are open.
          */}
          <main id="app-scroll" data-scroll-container className="flex-1 overflow-auto p-6">
            {/* Pages rely on shop_id; enforce selection early */}
            {!selectedShopId ? (
              <div className="max-w-xl">
                <div className="text-2xl font-bold text-foreground mb-2">У вас пока нет магазинов</div>
                <div className="text-sm text-muted-foreground mb-4">
                  Создайте первый магазин — после этого вы сможете подключить токен WB и начать работу с отзывами/вопросами/чатами.
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  Создать магазин
                </Button>
              </div>
            ) : (
              <>{children}</>
            )}
          </main>
        </ShopProvider>
      </div>
    </div>
  )
}
