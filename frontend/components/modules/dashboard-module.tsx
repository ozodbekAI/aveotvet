"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Star } from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  RadialBarChart,
  RadialBar,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

import { getDashboard, listShops, syncDashboard, type DashboardOut, type DashboardTabKey } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

type PeriodKey = "14d" | "7d" | "30d"

type Shop = { id: number; name: string }

function fmtPeriodLabel(p: PeriodKey) {
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
  if (tab === "feedbacks") return { primary: "Положительные", secondary: "Отрицательные" }
  if (tab === "questions") return { primary: "Ожидают", secondary: "Отвеченные" }
  return { primary: "Новые", secondary: "Все" }
}

export default function DashboardModule() {
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("feedbacks")
  const [period, setPeriod] = useState<PeriodKey>("14d")
  const [topTab, setTopTab] = useState<"primary" | "secondary">("primary")

  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShop, setSelectedShop] = useState<string>("all") // "all" or shop id

  const [data, setData] = useState<DashboardOut | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isPolling, error: pollError, pollJobs } = useSyncPolling()

  // Load real shops list (for Dashboard-local selection)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const items = await listShops()
        if (!mounted) return
        setShops(items || [])
      } catch {
        // ignore - page-level guard will handle auth/back-end issues
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const selectedShopId = useMemo(() => {
    if (selectedShop === "all") return null
    const n = Number.parseInt(selectedShop, 10)
    return Number.isFinite(n) ? n : null
  }, [selectedShop])

  const loadDashboard = useCallback(async () => {
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
    loadDashboard()
    // reset top-tab when changing main entity
    setTopTab("primary")
  }, [loadDashboard, activeTab])

  const handleRefresh = useCallback(async () => {
    setError(null)
    try {
      const res = await syncDashboard(activeTab, {
        shop_id: selectedShopId,
        period,
      })
      const ids = (res.job_ids && res.job_ids.length ? res.job_ids : res.job_id ? [res.job_id] : []).filter(
        (x) => Number.isFinite(x) && x > 0,
      )
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
    if (activeTab === "feedbacks") return Math.round(Number(kpis?.positive_share || 0))
    return answeredPct
  }, [activeTab, kpis, answeredPct])

  const gaugeData = useMemo(
    () => [{ name: "metric", value: gaugeValue, fill: "hsl(var(--primary))" }],
    [gaugeValue],
  )

  const top = data?.top
  const topLabels = topTabLabels(activeTab)
  const topList = topTab === "primary" ? top?.primary || [] : top?.secondary || []

  const shopSelectItems = useMemo(() => {
    const items: Array<{ value: string; label: string }> = [{ value: "all", label: "Все магазины" }]
    shops.forEach((s) => items.push({ value: String(s.id), label: s.name }))
    return items
  }, [shops])

  const dashboardTitle = useMemo(() => {
    if (activeTab === "questions") return "Главная · Вопросы"
    if (activeTab === "chats") return "Главная · Чаты"
    return "Главная"
  }, [activeTab])

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl font-bold text-foreground">{dashboardTitle}</div>

          <div className="flex items-center gap-2">
            <Select value={selectedShop} onValueChange={setSelectedShop}>
              <SelectTrigger className="w-[260px] bg-card border-border">
                <SelectValue placeholder="Все магазины" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {shopSelectItems.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[200px] bg-card border-border">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
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
                {/* KPI + Gauge + Premium */}
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
                            {activeTab !== "feedbacks" && (
                              <div className="text-xs text-muted-foreground">{answeredPct}%</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {activeTab === "feedbacks" ? "Средний рейтинг отзывов" : "Доля отвеченных"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activeTab === "feedbacks" ? (
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <Star className="h-4 w-4 text-primary" />
                          <div className="text-2xl font-bold text-foreground">
                            {Number(kpis?.avg_rating || 0).toFixed(1)}
                          </div>
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
                        <div className="text-xs text-muted-foreground">
                          {activeTab === "feedbacks" ? "Положительных отзывов" : "Отвечено"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-1 space-y-6">
                    <Card className="border-border overflow-hidden">
                      <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
                        <div className="text-sm opacity-90">Премиум-подписка</div>
                        <div className="text-3xl font-bold mt-1">Активирована</div>
                        <div className="text-xs opacity-80 mt-2">до 20 января 2026 г.</div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Line chart + Top */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-base">
                        Динамика изменений <span className="text-primary">{tabLabel(activeTab)}</span>
                      </CardTitle>
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
                      <div className="text-xs text-muted-foreground mt-3">{data?.line?.period_text || ""}</div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">{topTitle(activeTab)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
                        <TabsList className="w-full">
                          <TabsTrigger value="primary" className="flex-1">
                            {topLabels.primary}
                          </TabsTrigger>
                          <TabsTrigger value="secondary" className="flex-1">
                            {topLabels.secondary}
                          </TabsTrigger>
                        </TabsList>

                        <div className="mt-4 space-y-3">
                          {isLoading ? (
                            <div className="text-sm text-muted-foreground">Загрузка…</div>
                          ) : topList.length ? (
                            topList.map((it, idx) => (
                              <div key={idx} className="rounded-xl bg-muted/40 border border-border p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                                      {it.title}
                                    </div>
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
                      <div className="text-xs text-muted-foreground">
                        Период: {data?.meta?.date_from_iso?.slice(0, 10)} — {data?.meta?.date_to_iso?.slice(0, 10)}
                      </div>
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
