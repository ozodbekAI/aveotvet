"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Download, RefreshCw, Search, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

import FeedbacksFeed, { FeedbackRow } from "@/components/feedback/feedbacks-feed"
import FeedbackDetailDialog, { FeedbackDetail } from "@/components/feedback/feedback-detail-dialog"
import { bulkDraftFeedbacks, getFeedback, listFeedbacks, syncFeedbacks } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"
import { useToast } from "@/components/ui/use-toast"

type Section = "waiting" | "archive" | "all"

async function fetchFeedbackDetail(shopId: number, wbId: string): Promise<FeedbackDetail> {
  return (await getFeedback(shopId, wbId)) as any
}

export default function FeedbacksModule({ shopId }: { shopId: number | null }) {
  const { toast } = useToast()
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const [section, setSection] = useState<Section>("waiting")

  const [q, setQ] = useState("")
  const [rating, setRating] = useState("all")
  const [textFilter, setTextFilter] = useState("all")
  const [photoFilter, setPhotoFilter] = useState("all")

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

  // bulk draft
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLimit, setBulkLimit] = useState<string>("30")
  const [bulkLoading, setBulkLoading] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadLockRef = useRef(false)

  const title = useMemo(() => {
    const suffix = section === "waiting" ? "Ожидают ответа" : section === "archive" ? "Архив" : "Все отзывы"
    return `Отзывы — ${suffix}`
  }, [section])

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
        const nextOffset = reset ? 0 : offsetRef.current

        const has_text = textFilter === "all" ? undefined : textFilter === "with"
        const has_media = photoFilter === "all" ? undefined : photoFilter === "with"
        const ratingNum = rating === "all" ? undefined : Number(rating)

        // IMPORTANT: only limit/offset (no date_from_unix/date_to_unix)
        const data = await listFeedbacks(shopId, {
          is_answered: section === "waiting" ? false : section === "archive" ? true : undefined,
          q: q || undefined,
          limit,
          offset: nextOffset,
          rating: Number.isFinite(ratingNum) ? ratingNum : undefined,
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
    // IMPORTANT: do not depend on `offset` here; we read it from `offsetRef`.
    [shopId, textFilter, photoFilter, rating, section, q, setOffsetSafe],
  )

  useEffect(() => {
    if (!shopId) return
    setOffsetSafe(0)
    setHasMore(true)
    load(true)
  }, [shopId, section, q, rating, textFilter, photoFilter, load, setOffsetSafe])

  // Infinite scroll sentinel (no "Загрузить ещё")
  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (!hasMore || isLoading) return
        load(false)
      },
      { root: scrollRef.current, rootMargin: "240px" },
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, isLoading, load])

  async function handleSync() {
    if (!shopId) return
    try {
      // No date range here as well
      const res = await syncFeedbacks(shopId, {
        is_answered: section === "waiting" ? false : section === "archive" ? true : undefined,
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

  async function openDetail(wbId: string) {
    if (!shopId) return
    const fromWaiting = section === "waiting"
    setDetailIntent({ initialTab: fromWaiting ? "answer" : "review", autoFocusAnswer: fromWaiting })
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

      const res = await bulkDraftFeedbacks(shopId, { wb_ids: wbIds, limit: n })
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

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-foreground truncate">{title}</div>
          {pollError ? <div className="text-sm text-destructive mt-1">{pollError}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {section === "waiting" ? (
            <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={isLoading || isPolling} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Сгенерировать ответы
            </Button>
          ) : null}

          <Button variant="outline" onClick={handleSync} disabled={isLoading || isPolling} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading || isPolling ? "animate-spin" : ""}`} />
            {isPolling ? "Синхронизация…" : "Синхронизировать"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-10 rounded-2xl border border-border bg-background/80 backdrop-blur p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[320px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Артикул или название"
              className="pl-9 rounded-xl"
            />
          </div>

          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="Все оценки" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все оценки</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="1">1</SelectItem>
            </SelectContent>
          </Select>

          <Select value={textFilter} onValueChange={setTextFilter}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Текст" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Текст: все</SelectItem>
              <SelectItem value="with">С текстом</SelectItem>
              <SelectItem value="without">Без текста</SelectItem>
            </SelectContent>
          </Select>

          <Select value={photoFilter} onValueChange={setPhotoFilter}>
            <SelectTrigger className="w-[160px] rounded-xl">
              <SelectValue placeholder="Медиа" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Медиа: все</SelectItem>
              <SelectItem value="with">С фото/видео</SelectItem>
              <SelectItem value="without">Без фото/видео</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Select value={section} onValueChange={(v) => setSection(v as Section)}>
              <SelectTrigger className="w-[170px] rounded-xl">
                <SelectValue placeholder="Раздел" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="waiting">Ожидают ответа</SelectItem>
                <SelectItem value="archive">Архив</SelectItem>
                <SelectItem value="all">Все</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAllLoaded(Boolean(v))} />
              <div className="text-sm text-foreground">
                Выбрано: <span className="font-semibold">{selected.size}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card">
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
      </div>

      {/* Detail */}
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
    </div>
  )
}
