"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Download, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import FeedbacksTable, { FeedbackRow } from "@/components/feedback/feedbacks-table"
import FeedbackDetailDialog, { FeedbackDetail } from "@/components/feedback/feedback-detail-dialog"
import { listFeedbacks } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"

type Section = "waiting" | "archive"

async function fetchFeedbackDetail(shopId: number, wbId: string): Promise<FeedbackDetail> {
  const token = getAuthToken()
  const res = await fetch(`/api/feedbacks/${shopId}/${encodeURIComponent(wbId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to load feedback detail (${res.status})`)
  }
  return res.json()
}

export default function FeedbacksModule({ shopId }: { shopId: number | null }) {
  const [section, setSection] = useState<Section>("waiting")

  const [q, setQ] = useState("")
  const [period, setPeriod] = useState("14d")
  const [rating, setRating] = useState("all")
  const [textFilter, setTextFilter] = useState("all")
  const [photoFilter, setPhotoFilter] = useState("all")
  const [shopsFilter, setShopsFilter] = useState("all")

  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [limit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  // detail modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<FeedbackDetail | null>(null)

  const title = useMemo(() => {
    const suffix = section === "waiting" ? "Ожидают публикации" : "Архив"
    return `Ответы на отзывы — ${suffix}`
  }, [section])

  async function load(reset = false) {
    if (!shopId) return
    setIsLoading(true)
    try {
      const currentOffset = reset ? 0 : offset
      const data = await listFeedbacks(shopId, {
        is_answered: section === "waiting" ? false : true,
        q: q || undefined,
        limit,
        offset: currentOffset,
      })

      const list = (data || []) as FeedbackRow[]
      if (reset) {
        setRows(list)
        setOffset(limit)
      } else {
        setRows((prev) => [...prev, ...list])
        setOffset((prev) => prev + limit)
      }

      setHasMore(list.length === limit)
      if (reset) setSelected(new Set())
    } catch (e) {
      console.error("[feedbacks] load failed:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!shopId) return
    setOffset(0)
    setHasMore(true)
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, section, q])

  async function handleSync() {
    await load(true)
  }

  // Toggle functions
  function toggleOne(wbId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(wbId)) {
        next.delete(wbId)
      } else {
        next.add(wbId)
      }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map((r) => r.wb_id)))
    }
  }

  async function openDetail(wbId: string) {
    if (!shopId) return
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

  if (!shopId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="text-lg font-semibold text-foreground">Магазин не выбран</div>
          <div className="text-sm text-muted-foreground mt-2">Сначала выберите магазин в левом верхнем списке.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Right content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-foreground truncate">{title}</div>
          </div>

          <Button variant="outline" onClick={handleSync} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Синхронизация..." : "Обновить"}
          </Button>
        </div>

        {/* Filters bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[320px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Артикул или название" className="pl-9" />
          </div>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="14d">14 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
            </SelectContent>
          </Select>

          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Текст" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Текст</SelectItem>
              <SelectItem value="with">С текстом</SelectItem>
              <SelectItem value="without">Без текста</SelectItem>
            </SelectContent>
          </Select>

          <Select value={photoFilter} onValueChange={setPhotoFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Фото" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Фото</SelectItem>
              <SelectItem value="with">С фото</SelectItem>
              <SelectItem value="without">Без фото</SelectItem>
            </SelectContent>
          </Select>

          <Select value={shopsFilter} onValueChange={setShopsFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Все магазины" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все магазины</SelectItem>
              <SelectItem value="current">Текущий магазин</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="ml-auto gap-2">
            <Download className="h-4 w-4" />
            Excel
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </div>

        {/* Table */}
        <FeedbacksTable
          rows={rows}
          selected={selected}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          onOpen={openDetail}
          isLoading={isLoading}
        />

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Выбрано: {selected.size}</div>

          <Button variant="outline" disabled={!hasMore || isLoading} onClick={() => load(false)}>
            {hasMore ? "Загрузить ещё" : "Больше нет"}
          </Button>
        </div>
      </div>

      {/* Detail modal */}
      <FeedbackDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={detailData}
        loading={detailLoading}
        error={detailError}
      />
    </div>
  )
}