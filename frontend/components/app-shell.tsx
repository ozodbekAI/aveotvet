"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import Sidebar from "@/components/layout/sidebar"
import { ShopProvider } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { getBillingShop, listShops, getMe, getSettings, updateSettings, syncDashboardAll, getDashboardMain, type ShopOut, type ShopBilling } from "@/lib/api"
import { clearAuthToken } from "@/lib/auth"
import { LogOut, RefreshCw, Play, Pause, Plus, Wand2 } from "lucide-react"
import { useSyncPolling } from "@/hooks/use-sync-polling"

const SELECTED_SHOP_KEY = "wb_otveto_selected_shop_id"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [shops, setShops] = useState<ShopOut[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null)
  // Start in "loading" to avoid redirecting to onboarding before the first fetch.
  const [loadingShops, setLoadingShops] = useState(true)
  const [shopsLoaded, setShopsLoaded] = useState(false)
  const [shopsError, setShopsError] = useState<string | null>(null)

  const [me, setMe] = useState<{ id: number; email: string; role: string } | null>(null)

  const [shopBilling, setShopBilling] = useState<ShopBilling | null>(null)
  const [shopBalanceLoading, setShopBalanceLoading] = useState(false)

  const [automationEnabled, setAutomationEnabled] = useState<boolean | null>(null)
  const [automationLoading, setAutomationLoading] = useState(false)

  const [onboardingNeeded, setOnboardingNeeded] = useState(false)
  
  const [isSyncing, setIsSyncing] = useState(false)
  const { isPolling, pollJobs } = useSyncPolling()
  
  // Sidebar counts
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0)
  const [unansweredCount, setUnansweredCount] = useState(0)

  const selectedShop = useMemo(() => shops.find((s) => s.id === selectedShopId) || null, [shops, selectedShopId])
  const selectedShopRole = useMemo(() => (selectedShop?.my_role as any) || null, [selectedShop])

  const userInitial = useMemo(() => {
    const v = me?.email?.trim() || "U"
    return v[0]?.toUpperCase() || "U"
  }, [me?.email])

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
    setShopsError(null)
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
    } catch (e: any) {
      setShopsError(e?.message || "Не удалось загрузить список магазинов")
      throw e
    } finally {
      setLoadingShops(false)
      setShopsLoaded(true)
    }
  }, [selectedShopId])

  const handleSyncAll = useCallback(async () => {
    if (!selectedShopId || isSyncing || isPolling) return
    setIsSyncing(true)
    try {
      const res = await syncDashboardAll({ shop_id: selectedShopId })
      const ids = (res.job_ids || []).filter((x) => Number.isFinite(x) && x > 0)
      if (ids.length) {
        pollJobs(ids, async () => {
          await refresh()
        })
      } else {
        await refresh()
      }
    } catch (e: any) {
      console.error("Sync failed:", e)
    } finally {
      setIsSyncing(false)
    }
  }, [selectedShopId, isSyncing, isPolling, pollJobs, refresh])

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

  // If user has no shops yet, move them into the onboarding flow.
  useEffect(() => {
    if (!shopsLoaded || loadingShops) return
    if (shopsError) return
    if (shops.length === 0 && pathname.startsWith("/app") && pathname !== "/app/onboarding") {
      router.replace("/app/onboarding")
    }
  }, [shopsLoaded, loadingShops, shopsError, shops.length, pathname, router])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) {
        if (mounted) setShopBilling(null)
        return
      }

      const role = shops.find((s) => s.id === selectedShopId)?.my_role
      // billing is owner-only.
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

  // Load sidebar counts (pending drafts, unanswered feedbacks)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) {
        if (mounted) {
          setPendingDraftsCount(0)
          setUnansweredCount(0)
        }
        return
      }
      try {
        const data = await getDashboardMain({ shop_id: selectedShopId, period: "all" })
        if (!mounted) return
        setPendingDraftsCount(data?.feedbacks?.draftsReady || 0)
        setUnansweredCount(data?.feedbacks?.unanswered || 0)
      } catch {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [selectedShopId])

  // Load automation switch + onboarding flag for selected shop
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) {
        if (mounted) {
          setAutomationEnabled(null)
          setOnboardingNeeded(true)
        }
        return
      }
      try {
        if (mounted) setAutomationLoading(true)
        const s: any = await getSettings(selectedShopId)
        if (!mounted) return
        setAutomationEnabled(Boolean(s?.automation_enabled))
        const done = Boolean(s?.config?.onboarding?.done)
        setOnboardingNeeded(!done)
      } catch {
        if (!mounted) return
        setAutomationEnabled(null)
        // safest: if settings can't be loaded, assume onboarding still needed
        setOnboardingNeeded(true)
      } finally {
        if (mounted) setAutomationLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedShopId])

  const toggleAutomation = async () => {
    if (!selectedShopId) return
    if (automationEnabled === null) return
    if (onboardingNeeded) return

    const next = !automationEnabled
    try {
      setAutomationLoading(true)
      await updateSettings(selectedShopId, { automation_enabled: next })
      setAutomationEnabled(next)
    } catch {
      // ignore
    } finally {
      setAutomationLoading(false)
    }
  }

  const handleShopChange = (shopId: number) => {
    setSelectedShopId(shopId)
    router.refresh()
  }

  const handleAddShop = () => {
    // Clear wizard state so user starts fresh when adding a new shop
    try {
      window.localStorage.removeItem("wb_otveto_setup_wizard_v2")
    } catch {
      // ignore
    }
    router.push("/app/onboarding?new=1")
  }

  const handleLogout = () => {
    clearAuthToken()
    router.push("/login")
    router.refresh()
  }

  const allowNoShop = pathname === "/app/onboarding"

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
        onAddShop={handleAddShop}
        settingsDot={onboardingNeeded}
        pendingDraftsCount={pendingDraftsCount}
        unansweredCount={unansweredCount}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border px-6 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Left: user + shop */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {userInitial}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {me?.email || (loadingShops ? "Загрузка…" : "Пользователь")}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Магазин</div>
                  <Select
                    value={selectedShopId ? selectedShopId.toString() : ""}
                    onValueChange={(value) => handleShopChange(Number.parseInt(value, 10))}
                    disabled={shops.length === 0}
                  >
                    <SelectTrigger className="h-8 w-[220px] rounded-xl bg-background border-border">
                      <SelectValue placeholder={shops.length ? "Выберите магазин" : "Магазинов нет"} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {shops.map((shop) => (
                        <SelectItem key={shop.id} value={shop.id.toString()} className="text-foreground">
                          {shop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={handleAddShop}
                    className="rounded-xl"
                    aria-label="Добавить магазин"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: chips + actions */}
            <div className="flex items-center gap-3">
              {selectedShopRole === "owner" ? (
                <div className="hidden lg:flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Баланс:</span>
                    <span className="font-semibold tabular-nums">
                      {shopBalanceLoading ? "…" : shopBilling?.credits_balance ?? 0}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Расход/мес:</span>
                    <span className="font-semibold tabular-nums">
                      {shopBalanceLoading ? "…" : shopBilling?.credits_spent ?? 0}
                    </span>
                  </div>
                </div>
              ) : null}

              {selectedShopId && (selectedShopRole === "owner" || selectedShopRole === "manager") ? (
                onboardingNeeded ? (
                  <Button
                    onClick={() => router.push("/app/onboarding")}
                    size="sm"
                    variant="default"
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Wand2 className="h-4 w-4" />
                    Запустить мастер
                  </Button>
                ) : (
                  <Button
                    onClick={toggleAutomation}
                    disabled={automationLoading || automationEnabled === null}
                    size="sm"
                    variant={automationEnabled ? "outline" : "default"}
                    className={
                      automationEnabled
                        ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-200"
                        : ""
                    }
                  >
                    {automationEnabled ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Остановить
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Запустить
                      </>
                    )}
                  </Button>
                )
              ) : null}

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncAll} 
                disabled={isSyncing || isPolling}
                className="border-border text-foreground hover:bg-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${(isSyncing || isPolling) ? 'animate-spin' : ''}`} />
                {isSyncing || isPolling ? 'Синхр...' : 'Обновить'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10"
              >
                Выйти
                <LogOut className="h-4 w-4" />
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
            {/* Pages rely on shop_id; enforce selection early (except onboarding route) */}
            {!selectedShopId && !allowNoShop ? (
              <div className="max-w-xl">
                <div className="text-2xl font-bold text-foreground mb-2">У вас пока нет магазинов</div>
                <div className="text-sm text-muted-foreground mb-4">
                  Создайте первый магазин — после этого вы сможете подключить токен WB и начать работу с отзывами/вопросами/чатами.
                </div>
                <Button onClick={handleAddShop}>Создать магазин</Button>
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
