"use client"

import { AlertTriangle, Star, Image as ImageIcon, MessageSquareText, MessageCircle, FileText } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type FeedbackRow = {
  wb_id: string
  created_date: string
  product_valuation?: number | null
  user_name?: string | null
  text?: string | null
  pros?: string | null
  cons?: string | null
  was_viewed?: boolean | null
  answer_text?: string | null
  answer_editable?: string | null
  product_details?: any | null
  product_image_url?: string | null
}

function formatDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ""
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ""
  return dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function getProductTitle(pd: any | null | undefined) {
  if (!pd) return "Товар"
  return pd.productName || pd.product_name || pd.name || pd.title || "Товар"
}

function getBrand(pd: any | null | undefined) {
  if (!pd) return ""
  return pd.brandName || pd.brand || ""
}

function getArticle(pd: any | null | undefined) {
  if (!pd) return ""
  const nm = pd.nmId ?? pd.nm_id ?? pd.nmID
  return nm ? `${nm}` : ""
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="w-4 h-4 bg-muted rounded" />
      <div className="w-20 h-8 bg-muted rounded" />
      <div className="w-10 h-10 bg-muted rounded-lg" />
      <div className="w-10 h-4 bg-muted rounded" />
      <div className="flex-1 h-10 bg-muted rounded" />
      <div className="w-24 h-4 bg-muted rounded" />
      <div className="w-16 h-4 bg-muted rounded" />
    </div>
  )
}

export default function FeedbacksFeed({
  rows,
  selected,
  onToggle,
  // BACKWARD + FORWARD COMPAT:
  // feedbacks-module.tsx ba'zan onOpenDetail yuboradi, ba'zan onOpen.
  onOpen,
  onOpenDetail,
  isLoading,
}: {
  rows: FeedbackRow[]
  selected: Set<string>
  onToggle: (wbId: string) => void
  onOpen?: (wbId: string) => void
  onOpenDetail?: (wbId: string) => void
  isLoading: boolean
}) {
  // unified handler
  const handleOpen = (wbId: string) => {
    const fn = onOpenDetail || onOpen
    if (typeof fn === "function") fn(wbId)
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    )
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Ничего не найдено
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((r, index) => {
        const pd = r.product_details || null
        const title = getProductTitle(pd)
        const brand = getBrand(pd)
        const art = getArticle(pd)
        const rating = Number(r.product_valuation || 0)
        const answered = Boolean(r.answer_text && r.answer_text.trim())
        const isNegative = rating <= 2
        const needsAttention = isNegative && !answered

        return (
          <div
            key={r.wb_id}
            role="button"
            tabIndex={0}
            onClick={() => handleOpen(r.wb_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleOpen(r.wb_id)
            }}
            className={cn(
              "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
              needsAttention && "bg-red-50/50 dark:bg-red-950/20"
            )}
          >
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected.has(r.wb_id)}
                onCheckedChange={() => onToggle(r.wb_id)}
                aria-label={`Select ${r.wb_id}`}
              />
            </div>

            {/* Date */}
            <div className="w-20 shrink-0 text-xs text-muted-foreground">
              <div>{formatDate(r.created_date)}</div>
              <div className="text-[10px]">{formatTime(r.created_date)}</div>
            </div>

            {/* Image */}
            <div className="w-10 h-10 rounded-lg bg-muted/50 overflow-hidden shrink-0 border border-border">
              {r.product_image_url ? (
                <img
                  src={r.product_image_url}
                  alt={title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Rating */}
            <div className="w-10 shrink-0 flex items-center gap-0.5">
              <Star className={cn(
                "h-4 w-4",
                isNegative ? "text-red-500 fill-red-500" : rating >= 4 ? "text-green-500 fill-green-500" : "text-yellow-500 fill-yellow-500"
              )} />
              <span className={cn(
                "text-sm font-medium",
                isNegative ? "text-red-500" : "text-foreground"
              )}>{rating}</span>
            </div>

            {/* Product title with badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "text-sm font-medium line-clamp-1",
                  isNegative ? "text-red-600 dark:text-red-400" : "text-primary"
                )}>
                  {title}
                </span>
                {needsAttention && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Требует внимания
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">W</span>
                  {brand || "Avemod"}
                </span>
                {art && <span className="ml-2">· {art}</span>}
              </div>
            </div>

            {/* Status */}
            <div className="w-24 shrink-0 text-right">
              {answered ? (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Опубликован</span>
              ) : (
                <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Ожидает</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Комментарии">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Детали">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
