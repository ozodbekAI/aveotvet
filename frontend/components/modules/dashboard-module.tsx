"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, SlidersHorizontal, Star, Wallet } from "lucide-react"
import {
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useShop } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { getDashboard, getSettings, syncDashboard, updateSettings, type DashboardOut, type DashboardTabKey } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

type PeriodKey = "all" | "14d" | "7d" | "30d"

function fmtPeriodLabel(p: PeriodKey) {
  if (p === "all") return "Весь период"
  if (p === "7d") return "Последние 7 дней"
  if (p === "30d") return "Последние 30 дней"
  return "Последние 14 дней"
}

function tabLabel(tab: DashboardTabKey) {
  if (tab === "questions") return "вопросов"
  if (tab === "chats") return "чатов"
  return "отзывов"
}

function topTitle(tab: DashboardTabKey) {
  if (tab === "chats") return "Топ покупателей по чатам"
  return "Топ товаров по обращениям"
}

function topTabLabels(tab: DashboardTabKey) {
  if (tab === "feedbacks") return { positive: "Положительные", negative: "Отрицательные" }
  if (tab === "questions") return { positive: "Ожидают", negative: "Отвеченные" }
  return { positive: "Новые", negative: "Все" }
}

export default function DashboardModule() {
  const { shopId, selectedShop, isSuperAdmin, billing, shopRole } = useShop()
  const router = useRouter()

  const [introOpen, setIntroOpen] = useState(false)
  const [introChecking, setIntroChecking] = useState(false)

  const [activeTab, setActiveTab] = useState<DashboardTabKey>("feedbacks")
  const [period, setPeriod] = useState<PeriodKey>("14d")
  const [topTab, setTopTab] = useState<"positive" | "negative">("positive")

  const [data, setData] = useState<DashboardOut | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isPolling, error: pollError, pollJobs } = useSyncPolling()

  const canManageShop = useMemo(() => {
    return Boolean(isSuperAdmin || shopRole === "owner" || shopRole === "manager")
  }, [isSuperAdmin, shopRole])

  const selectedShopId = shopId

  // One-time dashboard explanation right after onboarding.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) return
      try {
        if (mounted) setIntroChecking(true)
        const s: any = await getSettings(selectedShopId)
        const ob = s?.config?.onboarding
        if (ob?.done && !ob?.dashboard_intro_seen) {
          if (mounted) setIntroOpen(true)
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setIntroChecking(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedShopId])

  const finishIntro = useCallback(async () => {
    if (!selectedShopId) return
    try {
      await updateSettings(selectedShopId, {
        config: { onboarding: { dashboard_intro_seen: true } },
      })
    } catch {
      // ignore
    } finally {
      setIntroOpen(false)
      router.push("/app/feedbacks")
    }
  }, [router, selectedShopId])

  const loadDashboard = useCallback(async () => {
    if (!selectedShopId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await getDashboard(activeTab, {
        shop_id: selectedShopId,
        period,
      })
      setData(res)
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить данные")
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, period, selectedShopId])

  useEffect(() => {
    if (!selectedShopId) return
    loadDashboard()
    setTopTab("positive")
  }, [loadDashboard, selectedShopId, activeTab])

  const handleRefresh = useCallback(async () => {
    if (!selectedShopId) return
    setError(null)
    try {
      const res = await syncDashboard(activeTab, {
        shop_id: selectedShopId,
        period,
      })
      const ids = (res.job_ids || []).filter((x) => Number.isFinite(x) && x > 0)
      if (ids.length) {
        pollJobs(ids, loadDashboard)
      } else {
        loadDashboard()
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось запустить синхронизацию")
    }
  }, [activeTab, selectedShopId, period, pollJobs, loadDashboard])

  const kpis = data?.kpis
  const lineData = data?.line?.data || []

  const unansweredPct = useMemo(() => {
    const t = kpis?.total || 0
    if (t <= 0) return 0
    return Math.round(((kpis?.unanswered || 0) * 100) / t)
  }, [kpis])

  const answeredPct = useMemo(() => {
    const t = kpis?.total || 0
    if (t <= 0) return 0
    return Math.round(((kpis?.answered || 0) * 100) / t)
  }, [kpis])

  const gaugeValue = useMemo(() => {
    if (activeTab === "feedbacks") return Math.round(Number(kpis?.positiveShare || 0))
    return answeredPct
  }, [activeTab, kpis, answeredPct])

  const gaugeData = useMemo(() => [{ name: "metric", value: gaugeValue, fill: "hsl(var(--primary))" }], [gaugeValue])

  const top = data?.top
  const topLabels = topTabLabels(activeTab)
  const topList = topTab === "positive" ? top?.positive || [] : top?.negative || []

  const dashboardTitle = useMemo(() => {
    if (activeTab === "questions") return "Главная · Вопросы"
    if (activeTab === "chats") return "Главная · Чаты"
    return "Главная"
  }, [activeTab])

  if (!selectedShopId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="text-xl font-semibold">Магазин не выбран</div>
        <div className="text-sm text-muted-foreground mt-2">Выберите магазин в сайдбаре слева.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Dialog open={introOpen} onOpenChange={setIntroOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Быстрое объяснение (30 секунд)</DialogTitle>
            <DialogDescription>
              Я покажу, где здесь самое важное, а потом переведу вас на «Отзывы»...
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-border p-4">
              <div className="font-medium">1) Проблемы</div>
              <div className="text-sm text-muted-foreground">Здесь будут подсказки, что требует внимания.</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="font-medium">2) Ожидают ответа</div>
              <div className="text-sm text-muted-foreground">Отзывы без ответа. Внутри сразу открыт ввод ответа.</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="font-medium">3) Автоматизация</div>
              <div className="text-sm text-muted-foreground">Черновики/публикация работают по настройкам, которые вы только что задали.</div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={finishIntro} className="rounded-2xl">
              Перейти к отзывам
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-2xl font-bold text-foreground">{dashboardTitle}</div>
            <div className="text-sm text-muted-foreground truncate">Магазин: {selectedShop?.name ?? `#${selectedShopId}`}</div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[200px] bg-card border-border">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">{fmtPeriodLabel("all")}</SelectItem>
                <SelectItem value="7d">{fmtPeriodLabel("7d")}</SelectItem>
                <SelectItem value="14d">{fmtPeriodLabel("14d")}</SelectItem>
                <SelectItem value="30d">{fmtPeriodLabel("30d")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleRefresh} disabled={isPolling || isLoading} className="bg-primary hover:bg-primary/90">
          <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? "animate-spin" : ""}`} />
          {isPolling ? "Синхронизация…" : "Обновить данные"}
        </Button>
      </div>

      {(error || pollError) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {pollError || error}
        </div>
      )}

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTabKey)} className="space-y-4">
        <TabsList className="w-full bg-muted">
          <TabsTrigger value="feedbacks" className="flex-1">
            Отзывы
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1">
            Вопросы
          </TabsTrigger>
          <TabsTrigger value="chats" className="flex-1">
            Чаты
          </TabsTrigger>
        </TabsList>

        {(["feedbacks", "questions", "chats"] as DashboardTabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            {activeTab !== tab ? null : (
              <>
                {/* KPI + Gauge + Balance */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">Сводка</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="text-xs text-muted-foreground">Всего поступило</div>
                          <div className="text-3xl font-bold text-primary mt-1">{kpis?.total ?? 0}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="text-xs text-muted-foreground">Ожидают обработки</div>
                          <div className="text-3xl font-bold text-foreground mt-1">{kpis?.pending ?? 0}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="text-xs text-muted-foreground">Неотвеченные {tabLabel(activeTab)}</div>
                          <div className="flex items-end justify-between mt-1">
                            <div className="text-3xl font-bold text-foreground">{kpis?.unanswered ?? 0}</div>
                            <div className="text-xs text-muted-foreground">{unansweredPct}%</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="text-xs text-muted-foreground">Отвеченные {tabLabel(activeTab)}</div>
                          <div className="flex items-end justify-between mt-1">
                            <div className="text-3xl font-bold text-foreground">{kpis?.answered ?? 0}</div>
                            {activeTab !== "feedbacks" && <div className="text-xs text-muted-foreground">{answeredPct}%</div>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">{activeTab === "feedbacks" ? "Средний рейтинг отзывов" : "Доля отвеченных"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activeTab === "feedbacks" ? (
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <Star className="h-4 w-4 text-primary" />
                          <div className="text-2xl font-bold text-foreground">{Number(kpis?.avgRating || 0).toFixed(1)}</div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <div className="text-2xl font-bold text-foreground">{answeredPct}%</div>
                        </div>
                      )}

                      <div className="h-[170px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
                            <RadialBar dataKey="value" cornerRadius={999} />
                            <Tooltip />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="text-center -mt-10">
                        <div className="text-3xl font-bold text-primary">{gaugeValue}%</div>
                        <div className="text-xs text-muted-foreground">{activeTab === "feedbacks" ? "Положительных отзывов" : "Отвечено"}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-1 space-y-6">
                    <Card className="border-border overflow-hidden">
                      <div className="p-6 rounded-xl bg-gradient-to-br from-primary/20 via-primary/5 to-background">
                        <div className="text-xs text-muted-foreground">Баланс магазина</div>
                        {canManageShop ? (
                          <>
                            <div className="mt-2 flex items-end justify-between gap-2">
                              <div className="text-3xl font-bold text-foreground">{billing?.credits_balance ?? 0}</div>
                              <div className="text-xs text-muted-foreground pb-1">кредитов</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Потрачено: {billing?.credits_spent ?? 0}</div>
                            <div className="mt-4">
                              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                                <Link href="/app/billing">
                                  <Wallet className="h-4 w-4 mr-2" />
                                  Открыть баланс
                                </Link>
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 text-sm text-muted-foreground">Доступ к балансу ограничен вашей ролью.</div>
                        )}
                      </div>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Быстрые действия</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          Настройте лимиты автогенерации и автопубликации, чтобы контролировать расход кредитов и объём ответов.
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button asChild variant="outline" className="justify-start">
                                <Link href="/app/settings">
                              <SlidersHorizontal className="h-4 w-4 mr-2" />
                              Настройки автоответов
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="justify-start">
                            <Link href="/app/drafts">Открыть черновики</Link>
                          </Button>
                          <Button asChild variant="outline" className="justify-start">
                            <Link href="/app/feedbacks">Перейти к отзывам</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Line chart + Top */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-base">Динамика изменений <span className="text-primary">{tabLabel(activeTab)}</span></CardTitle>
                      <div className="text-xs text-muted-foreground">{fmtPeriodLabel(period)}</div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[320px]">
                        {isLoading ? (
                          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Загрузка…</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
                              <XAxis dataKey="d" tickMargin={8} />
                              <YAxis tickMargin={8} />
                              <Tooltip />
                              <Line type="monotone" dataKey="v" strokeWidth={2} dot />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-3">{data?.line?.periodText || ""}</div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">{topTitle(activeTab)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
                        <TabsList className="w-full">
                          <TabsTrigger value="positive" className="flex-1">{topLabels.positive}</TabsTrigger>
                          <TabsTrigger value="negative" className="flex-1">{topLabels.negative}</TabsTrigger>
                        </TabsList>

                        <div className="mt-4 space-y-3">
                          {isLoading ? (
                            <div className="text-sm text-muted-foreground">Загрузка…</div>
                          ) : topList.length ? (
                            topList.map((it, idx) => (
                              <div key={idx} className="rounded-xl bg-muted/40 border border-border p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground leading-snug line-clamp-2">{it.title}</div>
                                    {!!it.brand && <div className="text-xs text-muted-foreground mt-1">{it.brand}</div>}
                                  </div>
                                  <div className="text-xl font-bold text-primary">{it.count}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">Нет данных за выбранный период</div>
                          )}
                        </div>
                      </Tabs>

                      <Separator className="my-4" />
                      <div className="text-xs text-muted-foreground">Период: {data?.meta?.date_from?.slice(0, 10)} — {data?.meta?.date_to?.slice(0, 10)}</div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
