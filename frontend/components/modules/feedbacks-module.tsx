"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Download, Play, RefreshCw, Search, Sparkles, Star, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import FeedbacksFeed, { FeedbackRow } from "@/components/feedback/feedbacks-feed"
import FeedbackDetailDialog, { FeedbackDetail } from "@/components/feedback/feedback-detail-dialog"
import { bulkDraftFeedbacks, getDraft, getFeedback, getFeedbackProductAnalytics, listFeedbacks, listPendingDrafts, ProductAnalytics, syncFeedbacks } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"
import { useToast } from "@/components/ui/use-toast"
import DraftDetailSheet from "@/components/drafts/draft-detail-sheet"
import DraftsTable, { DraftRow } from "@/components/drafts/drafts-table"

type Section = "waiting" | "answered" | "drafts"

async function fetchFeedbackDetail(shopId: number, wbId: string): Promise<FeedbackDetail> {
  return (await getFeedback(shopId, wbId)) as any
}

export default function FeedbacksModule({ shopId }: { shopId: number | null }) {
  const { toast } = useToast()
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const [section, setSection] = useState<Section>("waiting")

  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [rating, setRating] = useState("all")
  const [textFilter, setTextFilter] = useState("all")
  const [photoFilter, setPhotoFilter] = useState("all")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q)
    }, 400)
    return () => clearTimeout(timer)
  }, [q])

  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const limit = 20
  const [offset, setOffset] = useState(0)
  // Keep a ref in sync to avoid including `offset` in callbacks/effects
  // (including it causes `load` identity changes and leads to request loops).
  const offsetRef = useRef(0)
  const [hasMore, setHasMore] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  // detail modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<FeedbackDetail | null>(null)
  const [detailIntent, setDetailIntent] = useState<{
    initialTab: "review" | "answer"
    autoFocusAnswer: boolean
  }>({ initialTab: "review", autoFocusAnswer: false })
  // Current index for navigation
  const [currentDetailIndex, setCurrentDetailIndex] = useState<number>(0)

  // Analytics collapse
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null)

  // bulk draft
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLimit, setBulkLimit] = useState<string>("30")
  const [bulkLoading, setBulkLoading] = useState(false)

  // Drafts state
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [draftHasMore, setDraftHasMore] = useState(true)
  const [draftDetailOpen, setDraftDetailOpen] = useState(false)
  const [draftDetailLoading, setDraftDetailLoading] = useState(false)
  const [draftDetailData, setDraftDetailData] = useState<any | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadLockRef = useRef(false)
  const draftOffsetRef = useRef(0)

  const setOffsetSafe = useCallback((next: number | ((prev: number) => number)) => {
    setOffset((prev) => {
      const v = typeof next === "function" ? (next as (p: number) => number)(prev) : next
      offsetRef.current = v
      return v
    })
  }, [])

  const load = useCallback(
    async (reset = false) => {
      if (!shopId) return
      if (loadLockRef.current) return
      loadLockRef.current = true

      setIsLoading(true)
      try {
        // Parse filter values for both sections
        const has_text = textFilter === "all" ? undefined : textFilter === "with"
        const has_media = photoFilter === "all" ? undefined : photoFilter === "with"
        
        // Parse rating filter - supports "all", "3", "1-2", "4-5"
        let rating_min: number | undefined
        let rating_max: number | undefined
        if (rating !== "all") {
          if (rating === "1-2") {
            rating_min = 1
            rating_max = 2
          } else if (rating === "4-5") {
            rating_min = 4
            rating_max = 5
          } else {
            const num = Number(rating)
            if (Number.isFinite(num)) {
              rating_min = num
              rating_max = num
            }
          }
        }

        // Handle drafts section separately
        if (section === "drafts") {
          const currentOffset = reset ? 0 : draftOffsetRef.current
          const data = await listPendingDrafts(shopId, { 
            limit, 
            offset: currentOffset,
            q: debouncedQ || undefined,
            has_text,
            has_media,
            rating_min,
            rating_max,
          })
          const list = (Array.isArray(data) ? data : []) as any[]
          const mapped: DraftRow[] = list.map((it) => {
            const fb = it?.feedback || it?.raw?.feedback || it?.feedback_data || null
            return {
              id: Number(it?.id),
              created_at: it?.created_at || it?.createdAt || it?.generated_at || it?.generatedAt || null,
              status: String(it?.status || "drafted"),
              text: it?.text ?? it?.answer_text ?? null,
              feedback: {
                wb_id: fb?.wb_id ?? fb?.wbId ?? it?.wb_id ?? it?.wbId ?? "",
                created_date: fb?.created_date ?? fb?.createdDate ?? fb?.created_at ?? fb?.createdAt ?? "",
                product_valuation: fb?.product_valuation ?? fb?.productValuation ?? null,
                user_name: fb?.user_name ?? fb?.userName ?? null,
                text: fb?.text ?? null,
                pros: fb?.pros ?? null,
                cons: fb?.cons ?? null,
                was_viewed: fb?.was_viewed ?? fb?.wasViewed ?? null,
                product_details: fb?.product_details ?? fb?.productDetails ?? null,
                product_image_url: fb?.product_image_url ?? fb?.productImageUrl ?? it?.product_image_url ?? it?.productImageUrl ?? null,
                photo_links: fb?.photo_links ?? fb?.photoLinks ?? null,
                raw: fb?.raw ?? fb ?? null,
              },
            }
          })

          if (reset) {
            setDraftRows(mapped)
            draftOffsetRef.current = limit
            setSelected(new Set())
            setDraftHasMore(mapped.length === limit)
          } else {
            setDraftRows((prev) => [...prev, ...mapped])
            draftOffsetRef.current += limit
            setDraftHasMore(mapped.length === limit)
          }
          setIsLoading(false)
          loadLockRef.current = false
          return
        }

        const nextOffset = reset ? 0 : offsetRef.current

        // IMPORTANT: only limit/offset (no date_from_unix/date_to_unix)
        const data = await listFeedbacks(shopId, {
          is_answered: section === "waiting" ? false : section === "answered" ? true : undefined,
          q: debouncedQ || undefined,
          limit,
          offset: nextOffset,
          rating_min,
          rating_max,
          has_text,
          has_media,
        })

        const list = (data || []) as FeedbackRow[]
        if (reset) {
          setRows(list)
          setOffsetSafe(limit)
          setSelected(new Set())
          setHasMore(list.length === limit)
        } else {
          // Defensive: if backend ignores offset/filters and returns duplicates,
          // prevent an infinite request loop.
          setRows((prev) => {
            const seen = new Set(prev.map((r) => r.wb_id))
            let added = 0
            const next = [...prev]
            for (const r of list) {
              if (!seen.has(r.wb_id)) {
                seen.add(r.wb_id)
                next.push(r)
                added += 1
              }
            }
            // If nothing new was added, stop further pagination.
            if (added === 0) {
              setHasMore(false)
            } else {
              setHasMore(list.length === limit)
            }
            return next
          })

          setOffsetSafe((prev) => prev + limit)
        }
      } catch (e) {
        console.error("[feedbacks] load failed:", e)
      } finally {
        setIsLoading(false)
        loadLockRef.current = false
      }
    },
    // IMPORTANT: do not depend on `offset` or `draftOffset` here; we read them from refs.
    [shopId, textFilter, photoFilter, rating, section, debouncedQ, setOffsetSafe],
  )

  useEffect(() => {
    if (!shopId) return
    setOffsetSafe(0)
    draftOffsetRef.current = 0
    setHasMore(true)
    setDraftHasMore(true)
    load(true)
  }, [shopId, section, debouncedQ, rating, textFilter, photoFilter, load, setOffsetSafe])

  // Load analytics
  useEffect(() => {
    if (!shopId) return
    getFeedbackProductAnalytics(shopId, 5)
      .then(setAnalytics)
      .catch((e) => console.error("[feedbacks] analytics load failed:", e))
  }, [shopId])

  // Infinite scroll sentinel (no "Загрузить ещё")
  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        // Check correct hasMore based on section
        const canLoadMore = section === "drafts" ? draftHasMore : hasMore
        if (!canLoadMore || isLoading) return
        load(false)
      },
      { root: scrollRef.current, rootMargin: "240px" },
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, draftHasMore, isLoading, load, section])

  async function handleSync() {
    if (!shopId) return
    try {
      // No date range here as well
      const res: any = await syncFeedbacks(shopId, {
        is_answered: section === "waiting" ? false : section === "answered" ? true : undefined,
        order: "dateDesc",
        take: 5000,
        skip: 0,
      })
      if (res?.job_id) {
        pollJob(res.job_id, () => load(true))
      } else {
        load(true)
      }
    } catch (e: any) {
      toast({
        title: "Синхронизация не запущена",
        description: e?.message || "Проверьте доступ и токен WB",
        variant: "destructive",
      })
    }
  }

  function toggleOne(wbId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(wbId)) next.delete(wbId)
      else next.add(wbId)
      return next
    })
  }

  function toggleAllLoaded(checked: boolean) {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((r) => r.wb_id)))
  }

  // Get unanswered rows for "Обработать" functionality
  const unansweredRows = useMemo(() => {
    return rows.filter((r) => !r.answer_text?.trim())
  }, [rows])

  const answeredCount = useMemo(() => {
    return rows.filter((r) => r.answer_text?.trim()).length
  }, [rows])

  async function openDetail(wbId: string, index?: number) {
    if (!shopId) return
    const fromWaiting = section === "waiting"
    setDetailIntent({ initialTab: fromWaiting ? "answer" : "review", autoFocusAnswer: fromWaiting })
    
    // Set index for navigation
    if (typeof index === "number") {
      setCurrentDetailIndex(index)
    } else {
      const foundIndex = unansweredRows.findIndex((r) => r.wb_id === wbId)
      setCurrentDetailIndex(foundIndex >= 0 ? foundIndex : 0)
    }
    
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)

    try {
      const data = await fetchFeedbackDetail(shopId, wbId)
      setDetailData(data)
    } catch (e: any) {
      setDetailError(e?.message || "Не удалось загрузить детали отзыва")
    } finally {
      setDetailLoading(false)
    }
  }

  // Open draft detail
  async function openDraftDetail(draftId: number) {
    if (!shopId) return
    setActiveDraftId(draftId)
    setDraftDetailOpen(true)
    setDraftDetailLoading(true)
    setDraftDetailData(null)

    try {
      const d = await getDraft(shopId, draftId)
      setDraftDetailData(d)
    } catch (e: any) {
      console.error("[draft detail] load failed:", e)
    } finally {
      setDraftDetailLoading(false)
    }
  }

  // Open first unanswered for processing
  function startProcessing() {
    if (unansweredRows.length === 0) return
    openDetail(unansweredRows[0].wb_id, 0)
  }

  // Navigate to previous feedback
  const goToPrev = useCallback(async () => {
    if (!shopId || currentDetailIndex <= 0) return
    const prevIndex = currentDetailIndex - 1
    const prevRow = unansweredRows[prevIndex]
    if (!prevRow) return
    
    setCurrentDetailIndex(prevIndex)
    setDetailLoading(true)
    setDetailError(null)
    
    try {
      const data = await fetchFeedbackDetail(shopId, prevRow.wb_id)
      setDetailData(data)
    } catch (e: any) {
      setDetailError(e?.message || "Не удалось загрузить детали")
    } finally {
      setDetailLoading(false)
    }
  }, [shopId, currentDetailIndex, unansweredRows])

  // Navigate to next feedback
  const goToNext = useCallback(async () => {
    if (!shopId || currentDetailIndex >= unansweredRows.length - 1) return
    const nextIndex = currentDetailIndex + 1
    const nextRow = unansweredRows[nextIndex]
    if (!nextRow) return
    
    setCurrentDetailIndex(nextIndex)
    setDetailLoading(true)
    setDetailError(null)
    
    try {
      const data = await fetchFeedbackDetail(shopId, nextRow.wb_id)
      setDetailData(data)
    } catch (e: any) {
      setDetailError(e?.message || "Не удалось загрузить детали")
    } finally {
      setDetailLoading(false)
    }
  }, [shopId, currentDetailIndex, unansweredRows])

  const reloadDetail = useCallback(async () => {
    if (!shopId || !detailData?.wb_id) return
    setDetailLoading(true)
    setDetailError(null)
    try {
      const data = await fetchFeedbackDetail(shopId, detailData.wb_id)
      setDetailData(data)
    } catch (e: any) {
      setDetailError(e?.message || "Не удалось обновить детали")
    } finally {
      setDetailLoading(false)
    }
  }, [shopId, detailData?.wb_id])

  async function handleBulkDraft() {
    if (!shopId) return
    const n = Math.max(1, Math.min(500, Number.parseInt(bulkLimit || "30", 10) || 30))
    setBulkLoading(true)
    try {
      const wbIds = Array.from(selected)
      if (!wbIds.length) {
        toast({
          title: "Выберите отзывы",
          description: "Отметьте отзывы галочками или выберите все загруженные.",
          variant: "destructive",
        })
        return
      }

      const res: any = await bulkDraftFeedbacks(shopId, { wb_ids: wbIds, limit: n } as any)
      toast({
        title: "Запущено",
        description: res?.message || "Генерация запущена",
      })
      setBulkOpen(false)
      setTimeout(() => load(true), 1200)
    } catch (e: any) {
      toast({
        title: "Не удалось запустить генерацию",
        description: e?.message || "Проверьте баланс и доступ",
        variant: "destructive",
      })
    } finally {
      setBulkLoading(false)
    }
  }

  if (!shopId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="text-lg font-semibold text-foreground">Магазин не выбран</div>
          <div className="text-sm text-muted-foreground mt-2">Сначала выберите магазин в левом верхнем списке.</div>
        </div>
      </div>
    )
  }

  const allChecked = rows.length > 0 && selected.size === rows.length
  const progressPercent = rows.length > 0 ? Math.round((answeredCount / rows.length) * 100) : 0

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Отзывы</h1>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <span>{answeredCount} из {rows.length} обработано</span>
            <Progress value={progressPercent} className="w-20 h-2" />
          </div>

          {/* Process button */}
          {unansweredRows.length > 0 && (
            <Button onClick={startProcessing} className="gap-2 bg-primary hover:bg-primary/90">
              <Play className="h-4 w-4" />
              Обработать ({unansweredRows.length})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {section === "waiting" && (
            <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={isLoading || isPolling} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Сгенерировать все
            </Button>
          )}

          <Button variant="outline" onClick={handleSync} disabled={isLoading || isPolling} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading || isPolling ? "animate-spin" : ""}`} />
            {isPolling ? "Синхронизация…" : "Синхронизировать"}
          </Button>
        </div>
      </div>

      {pollError && <div className="text-sm text-destructive">{pollError}</div>}

      {/* Analytics section (collapsible) */}
      <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 text-sm hover:opacity-80 transition-opacity w-full">
            <span className="font-medium text-foreground">Аналитика по товарам</span>
            <span className="text-muted-foreground">↗ {analytics?.top_products.length || 0} лидеров</span>
            <span className="text-muted-foreground">↘ {analytics?.problem_products.length || 0} проблемных</span>
            {analyticsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Лучшие по отзывам */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Лучшие по отзывам</span>
                </div>
                <div className="space-y-2">
                  {(analytics?.top_products || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Нет данных</div>
                  ) : (
                    analytics?.top_products.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate max-w-[200px]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.count}</span>
                          {item.recent > 0 && <span className="text-green-500 text-xs">+{item.recent}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Требуют внимания */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                  <span className="text-sm font-medium text-red-500">Требуют внимания</span>
                </div>
                <div className="space-y-2">
                  {(analytics?.problem_products || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Нет данных</div>
                  ) : (
                    analytics?.problem_products.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate max-w-[200px]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.count}</span>
                          {item.recent > 0 && <span className="text-red-500 text-xs">+{item.recent}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <div className="sticky top-0 z-10 rounded-2xl border border-border bg-background/80 backdrop-blur p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Section tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
            <button
              onClick={() => setSection("answered")}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                section === "answered" 
                  ? "bg-background shadow-sm text-foreground font-medium border border-border" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Есть ответ
            </button>
            <button
              onClick={() => setSection("waiting")}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                section === "waiting" 
                  ? "bg-background shadow-sm text-foreground font-medium border border-border" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ждут ответа
              {unansweredRows.length > 0 && section !== "waiting" && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              onClick={() => setSection("drafts")}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                section === "drafts" 
                  ? "bg-background shadow-sm text-foreground font-medium border border-border" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Черновики
              {draftRows.length > 0 && section !== "drafts" && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>

          <div className="relative w-[200px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по отзывам..."
              className="pl-9 rounded-xl h-9 text-sm"
            />
          </div>

          {/* Rating filters */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
            <button
              onClick={() => setRating("all")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                rating === "all" 
                  ? "bg-background shadow-sm text-foreground font-medium" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Все отзывы
            </button>
            {["1-2", "3", "4-5"].map((r) => (
              <button
                key={r}
                onClick={() => setRating(r === rating ? "all" : r)}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 text-sm transition-colors ${
                  rating === r 
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
                <Star className={`h-3 w-3 ${rating === r ? "fill-amber-500 text-amber-500" : ""}`} />
              </button>
            ))}
          </div>

          <Select value={textFilter} onValueChange={setTextFilter}>
            <SelectTrigger className="w-[100px] rounded-xl h-9 text-sm">
              <SelectValue placeholder="Текст" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Текст: все</SelectItem>
              <SelectItem value="with">С текстом</SelectItem>
              <SelectItem value="without">Без текста</SelectItem>
            </SelectContent>
          </Select>

          <Select value={photoFilter} onValueChange={setPhotoFilter}>
            <SelectTrigger className="w-[110px] rounded-xl h-9 text-sm">
              <SelectValue placeholder="Медиа" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Медиа: все</SelectItem>
              <SelectItem value="with">С фото/видео</SelectItem>
              <SelectItem value="without">Без фото</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
              <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAllLoaded(Boolean(v))} className="h-4 w-4" />
              <div className="text-sm text-foreground">
                Выбрано: <span className="font-semibold">{selected.size}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-9 px-3">
              ↕ По дате
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card">
        {section === "drafts" ? (
          <>
            <DraftsTable
              rows={draftRows}
              selected={new Set(Array.from(selected).map(Number).filter(n => !isNaN(n)))}
              onToggle={(id) => toggleOne(String(id))}
              onToggleAll={(checked) => {
                if (!checked) {
                  setSelected(new Set())
                } else {
                  setSelected(new Set(draftRows.map((r) => String(r.id))))
                }
              }}
              onOpen={openDraftDetail}
              isLoading={isLoading && draftRows.length === 0}
            />
            <div ref={sentinelRef} className="h-12" />
            {isLoading && draftRows.length > 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">Загрузка…</div>
            ) : null}
            {!draftHasMore && draftRows.length > 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Конец списка</div>
            ) : null}
            {!isLoading && draftRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Нет черновиков</div>
            ) : null}
          </>
        ) : (
          <>
            <FeedbacksFeed
              rows={rows}
              selected={selected}
              onToggle={toggleOne}
              onOpenDetail={openDetail}
              isLoading={isLoading && rows.length === 0}
            />
            <div ref={sentinelRef} className="h-12" />
            {isLoading && rows.length > 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">Загрузка…</div>
            ) : null}
            {!hasMore && rows.length > 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Конец списка</div>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ничего не найдено</div>
            ) : null}
          </>
        )}
      </div>

      {/* Detail with navigation */}
      <FeedbackDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        shopId={shopId}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        onReload={reloadDetail}
        initialTab={detailIntent.initialTab}
        autoFocusAnswer={detailIntent.autoFocusAnswer}
        currentIndex={currentDetailIndex}
        totalCount={unansweredRows.length}
        onPrev={goToPrev}
        onNext={goToNext}
      />

      {/* Bulk draft dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Сгенерировать ответы</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Будут сгенерированы ответы для выбранных отзывов. Выбрано: <b>{selected.size}</b>
            </div>
            <div className="space-y-2">
              <Label>Лимит генерации</Label>
              <Input value={bulkLimit} onChange={(e) => setBulkLimit(e.target.value)} placeholder="30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkLoading}>
              Отмена
            </Button>
            <Button onClick={handleBulkDraft} disabled={bulkLoading || selected.size === 0}>
              {bulkLoading ? "Запуск…" : "Запустить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Detail Sheet */}
      <DraftDetailSheet
        open={draftDetailOpen}
        onOpenChange={setDraftDetailOpen}
        shopId={shopId}
        draftId={activeDraftId}
        loading={draftDetailLoading}
        data={draftDetailData}
        error={null}
        onAfterAction={() => {
          load(true)
        }}
      />
    </div>
  )
}
