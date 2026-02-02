"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  HelpCircle, 
  MessageSquare, 
  RefreshCw, 
  Star, 
  TrendingUp,
  TrendingDown
} from "lucide-react"

import { useShop } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { 
  getDashboardMain, 
  getSettings, 
  syncDashboardAll, 
  updateSettings, 
  type DashboardMainOut, 
  type AttentionItem,
  type RatingDistribution
} from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

type PeriodKey = "all" | "14d" | "7d" | "30d"

function fmtPeriodLabel(p: PeriodKey) {
  if (p === "all") return "Весь период"
  if (p === "7d") return "Последние 7 дней"
  if (p === "30d") return "Последние 30 дней"
  return "Последние 14 дней"
}

function formatGrowth(val: number | undefined): string {
  if (val === undefined || val === 0) return ""
  return val > 0 ? `+${val}` : `${val}`
}

export default function DashboardModule() {
  const { shopId, selectedShop, isSuperAdmin, billing, shopRole } = useShop()
  const router = useRouter()

  const [introOpen, setIntroOpen] = useState(false)
  const [introChecking, setIntroChecking] = useState(false)

  const [period, setPeriod] = useState<PeriodKey>("all")

  const [dashboardData, setDashboardData] = useState<DashboardMainOut | null>(null)
  const [settings, setSettings] = useState<any>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isPolling, error: pollError, pollJobs } = useSyncPolling()

  const selectedShopId = shopId

  // One-time dashboard explanation right after onboarding.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!selectedShopId) return
      try {
        if (mounted) setIntroChecking(true)
        const s: any = await getSettings(selectedShopId)
        setSettings(s)
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
      const data = await getDashboardMain({ shop_id: selectedShopId, period })
      setDashboardData(data)
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить данные")
    } finally {
      setIsLoading(false)
    }
  }, [period, selectedShopId])

  useEffect(() => {
    if (!selectedShopId) return
    loadDashboard()
  }, [loadDashboard, selectedShopId])

  const handleRefresh = useCallback(async () => {
    if (!selectedShopId) return
    setError(null)
    setIsSyncing(true)
    try {
      const res = await syncDashboardAll({ shop_id: selectedShopId })
      const ids = (res.job_ids || []).filter((x) => Number.isFinite(x) && x > 0)
      if (ids.length) {
        pollJobs(ids, loadDashboard)
      } else {
        loadDashboard()
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось запустить синхронизацию")
    } finally {
      setIsSyncing(false)
    }
  }, [selectedShopId, pollJobs, loadDashboard])

  // Extract data
  const feedbacks = dashboardData?.feedbacks
  const questions = dashboardData?.questions
  const chats = dashboardData?.chats
  const attentionItems = dashboardData?.attentionItems || []
  const ratingDistribution = dashboardData?.ratingDistribution

  // Stats
  const totalFeedbacks = feedbacks?.total || 0
  const totalQuestions = questions?.total || 0
  const totalChats = chats?.total || 0
  const avgRating = feedbacks?.avgRating || 0

  // Automation mode
  const automationMode = useMemo(() => {
    const mode = dashboardData?.automationMode || settings?.config?.automation_mode || "control"
    if (mode === "autopilot") return "Автопилот"
    if (mode === "control") return "Контроль"
    return "Ручной"
  }, [dashboardData, settings])

  const syncInterval = useMemo(() => {
    return dashboardData?.syncInterval || settings?.config?.sync_interval || "каждый час"
  }, [dashboardData, settings])

  const automationStatus = dashboardData?.automationStatus || "ok"

  if (!selectedShopId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="text-xl font-semibold">Магазин не выбран</div>
        <div className="text-sm text-muted-foreground mt-2">Выберите магазин в сайдбаре слева.</div>
      </div>
    )
  }

  return (
    <TooltipProvider>
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

        {/* Header */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Главная</h1>
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

        {(error || pollError) && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {pollError || error}
          </div>
        )}

        {/* Attention Section */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="text-primary">⚡</span>
                Требует вашего внимания
              </div>
            </div>

            <div className="space-y-3">
              {attentionItems.map((item, idx) => (
                <AttentionItemCard key={idx} item={item} />
              ))}

              {/* No attention items */}
              {attentionItems.length === 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Всё под контролем!</div>
                    <div className="text-sm text-muted-foreground">Нет срочных задач</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid with Tooltips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Feedbacks */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-bold text-foreground">
                      {isLoading ? "…" : totalFeedbacks}
                    </div>
                    {feedbacks?.periodGrowth !== undefined && feedbacks.periodGrowth !== 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${feedbacks.periodGrowth > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                        {formatGrowth(feedbacks.periodGrowth)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Отзывов</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border border-border p-3 w-64">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Всего отзывов:</span>
                  <span className="font-medium">{totalFeedbacks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Обработано системой:</span>
                  <span className="font-medium text-green-600">{feedbacks?.processedBySystem || feedbacks?.answered || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Прирост за период:</span>
                  <span className="font-medium text-green-600">{formatGrowth(feedbacks?.periodGrowth) || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ожидают обработки:</span>
                  <span className="font-medium text-orange-600">{feedbacks?.awaitingProcessing || feedbacks?.unanswered || 0}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Questions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-bold text-foreground">
                      {isLoading ? "…" : totalQuestions}
                    </div>
                    {questions?.periodGrowth !== undefined && questions.periodGrowth !== 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${questions.periodGrowth > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                        {formatGrowth(questions.periodGrowth)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Вопросов</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border border-border p-3 w-64">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Всего вопросов:</span>
                  <span className="font-medium">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Обработано системой:</span>
                  <span className="font-medium text-green-600">{questions?.processedBySystem || questions?.answered || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Прирост за период:</span>
                  <span className="font-medium text-green-600">{formatGrowth(questions?.periodGrowth) || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ожидают ответа:</span>
                  <span className="font-medium text-orange-600">{questions?.unanswered || 0}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Chats */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-bold text-foreground">
                      {isLoading ? "…" : totalChats}
                    </div>
                    {chats?.periodGrowth !== undefined && chats.periodGrowth !== 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${chats.periodGrowth > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                        {formatGrowth(chats.periodGrowth)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Чатов</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border border-border p-3 w-64">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Всего чатов:</span>
                  <span className="font-medium">{totalChats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Закрыто:</span>
                  <span className="font-medium text-green-600">{chats?.closed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Прирост за период:</span>
                  <span className="font-medium text-green-600">{formatGrowth(chats?.periodGrowth) || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Активных:</span>
                  <span className="font-medium text-blue-600">{chats?.active || 0}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Rating with distribution */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-4xl font-bold text-foreground">
                      {isLoading ? "…" : Number(avgRating).toFixed(1)}
                    </div>
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-muted-foreground">
                      {ratingDistribution?.totalRated || 0}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Рейтинг</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border border-border p-4 w-80">
              {ratingDistribution && (
                <RatingDistributionBlock distribution={ratingDistribution} />
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Automation Status */}
        <Card className="border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  automationStatus === "ok" 
                    ? "bg-green-100 dark:bg-green-900/50" 
                    : automationStatus === "stale"
                    ? "bg-yellow-100 dark:bg-yellow-900/50"
                    : "bg-red-100 dark:bg-red-900/50"
                }`}>
                  <CheckCircle2 className={`w-5 h-5 ${
                    automationStatus === "ok"
                      ? "text-green-600 dark:text-green-400"
                      : automationStatus === "stale"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  }`} />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {automationStatus === "ok" 
                      ? "Автоматизация работает исправно" 
                      : automationStatus === "stale"
                      ? "Синхронизация устарела"
                      : "Проверьте настройки"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Режим: <span className="font-medium text-foreground">{automationMode}</span> — AI создаёт черновики, вы проверяете перед публикацией · Синхр. {syncInterval}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={isSyncing || isPolling}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${(isSyncing || isPolling) ? 'animate-spin' : ''}`} />
                  {isSyncing || isPolling ? 'Синхр...' : 'Обновить'}
                </Button>
                <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                  <Link href="/app/settings">Настройки</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function AttentionItemCard({ item }: { item: AttentionItem }) {
  const getStyles = () => {
    switch (item.severity) {
      case "high":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-900",
          iconBg: "bg-red-100 dark:bg-red-900/50",
          iconColor: "text-red-600 dark:text-red-400",
          buttonClass: "bg-red-500 hover:bg-red-600 text-white"
        }
      case "medium":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950/30",
          border: "border-yellow-200 dark:border-yellow-900",
          iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          buttonClass: ""
        }
      default:
        return {
          bg: "bg-card",
          border: "border-border",
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
          buttonClass: ""
        }
    }
  }

  const getIcon = () => {
    switch (item.type) {
      case "negative_reviews":
        return <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
      case "unanswered_reviews":
        return <Clock className={`w-5 h-5 ${styles.iconColor}`} />
      case "pending_drafts":
        return <Clock className={`w-5 h-5 ${styles.iconColor}`} />
      case "unanswered_questions":
        return <HelpCircle className={`w-5 h-5 ${styles.iconColor}`} />
      case "active_chats":
        return <MessageSquare className={`w-5 h-5 ${styles.iconColor}`} />
      default:
        return <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
    }
  }

  const getButtonLabel = () => {
    switch (item.type) {
      case "negative_reviews":
        return "Ответить"
      case "unanswered_reviews":
        return "Ответить"
      case "pending_drafts":
        return "Проверить"
      default:
        return "Открыть"
    }
  }

  const styles = getStyles()

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl ${styles.bg} border ${styles.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          {getIcon()}
        </div>
        <div>
          <div className="font-medium text-foreground">{item.title}</div>
          <div className="text-sm text-muted-foreground">{item.subtitle}</div>
        </div>
      </div>
      <Button 
        asChild 
        variant={item.severity === "high" ? "default" : item.severity === "medium" ? "outline" : "ghost"}
        className={styles.buttonClass}
      >
        <Link href={item.link}>
          {getButtonLabel()}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </Button>
    </div>
  )
}

function RatingDistributionBlock({ distribution }: { distribution: RatingDistribution }) {
  const total = distribution.totalRated || 1
  const maxCount = Math.max(distribution.stars5, distribution.stars4, distribution.stars3, distribution.stars2, distribution.stars1, 1)

  const ratings = [
    { stars: 5, count: distribution.stars5, growth: distribution.stars5Growth },
    { stars: 4, count: distribution.stars4, growth: distribution.stars4Growth },
    { stars: 3, count: distribution.stars3, growth: distribution.stars3Growth },
    { stars: 2, count: distribution.stars2, growth: distribution.stars2Growth },
    { stars: 1, count: distribution.stars1, growth: distribution.stars1Growth },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-medium text-foreground">Новых оценок</span>
        <span className="font-bold text-lg">{total.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {ratings.map((r) => (
          <div key={r.stars} className="flex items-center gap-2">
            <div className="flex items-center gap-1 w-10">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium">{r.stars}</span>
            </div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  r.stars >= 4 ? 'bg-yellow-400' : r.stars === 3 ? 'bg-purple-400' : 'bg-orange-400'
                }`}
                style={{ width: `${(r.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-sm w-16 text-right tabular-nums">{r.count.toLocaleString()}</span>
            {r.growth !== 0 && (
              <span className={`text-xs w-12 text-right ${r.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatGrowth(r.growth)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
