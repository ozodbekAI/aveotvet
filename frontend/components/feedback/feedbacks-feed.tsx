"use client"

import { Star, Image as ImageIcon, MessageSquareText } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  return dt.toLocaleDateString("ru-RU")
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
  return nm ? `Арт. ${nm}` : ""
}

function RatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < v
        return (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              active ? "text-primary fill-primary" : "text-muted-foreground/30",
            )}
          />
        )
      })}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-56 bg-muted rounded animate-pulse" />
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </div>
      <div className="mt-3 h-3 w-28 bg-muted rounded animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
      </div>
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
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Ничего не найдено
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pd = r.product_details || null
        const title = getProductTitle(pd)
        const brand = getBrand(pd)
        const art = getArticle(pd)
        const rating = Number(r.product_valuation || 0)
        const hasText = Boolean(r.text && r.text.trim())
        const hasMedia = Boolean(r.product_image_url) // list endpoint provides product image; media is still visible in details
        const answered = Boolean(r.answer_text && r.answer_text.trim())

        const snippet =
          (r.text && r.text.trim()) ||
          (r.pros && r.pros.trim() ? `Плюсы: ${r.pros.trim()}` : "") ||
          (r.cons && r.cons.trim() ? `Минусы: ${r.cons.trim()}` : "") ||
          "—"

        return (
          <div
            key={r.wb_id}
            role="button"
            tabIndex={0}
            onClick={() => handleOpen(r.wb_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleOpen(r.wb_id)
            }}
            className="group rounded-2xl border border-border bg-card p-4 cursor-pointer transition-shadow hover:shadow-md hover:shadow-black/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-muted/50 overflow-hidden shrink-0 border border-border">
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
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                      {title}
                    </div>
                    {answered ? (
                      <Badge variant="secondary" className="shrink-0">
                        Отвечено
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">
                        Ожидает
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    Wildberries{brand ? ` · ${brand}` : ""}{art ? ` · ${art}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 shrink-0">
                <div className="text-xs text-muted-foreground mt-1">{formatDate(r.created_date)}</div>
                <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
                  <Checkbox
                    checked={selected.has(r.wb_id)}
                    onCheckedChange={() => onToggle(r.wb_id)}
                    aria-label={`Select ${r.wb_id}`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RatingStars value={rating} />
                <div className="text-xs text-muted-foreground">
                  {Number.isFinite(rating) ? rating : 0}/5
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-1">
                  <MessageSquareText className="h-4 w-4" />
                  {hasText ? "текст" : "без текста"}
                </div>
                <div className={cn("inline-flex items-center gap-1", !hasMedia && "opacity-60")}>
                  <ImageIcon className="h-4 w-4" />
                  {hasMedia ? "фото" : "нет фото"}
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">{snippet}</div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Покупатель: {r.user_name || "—"}</div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpen(r.wb_id)
                }}
              >
                Открыть
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
