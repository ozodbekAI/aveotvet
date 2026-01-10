"use client"

import { Star } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DraftRow = {
  id: number
  created_at: string | null
  status: string
  text: string | null
  feedback: {
    wb_id: string
    created_date: string
    product_valuation?: number | null
    user_name?: string | null
    text?: string | null
    pros?: string | null
    cons?: string | null
    was_viewed?: boolean | null
    product_details?: any | null
    product_image_url?: string | null
    photo_links?: any[] | null
    raw?: any | null
  }
}

function formatDate(d?: string | null) {
  if (!d) return ""
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString("ru-RU")
}

function getProductTitle(pd: any | null | undefined) {
  if (!pd) return "Товар"
  return pd.productName || pd.product_name || pd.name || pd.title || "Товар"
}

function getBrand(pd: any | null | undefined) {
  if (!pd) return ""
  return pd.brandName || pd.brand || pd.supplierName || ""
}

function getArticle(pd: any | null | undefined) {
  if (!pd) return ""
  const nm = pd.nmId ?? pd.nm_id ?? pd.nmID
  return nm ? `Арт. ${nm}` : ""
}

function getBuyoutStatus(raw: any | null | undefined): string {
  // WB’da "Выкуп / Не выкуп" ma’nosi backendda har xil joydan kelishi mumkin.
  // Agar backend keyinroq aniq maydon bersa, shu yerda moslab qo‘yiladi.
  const v = raw?.buyout ?? raw?.isBuyout ?? raw?.is_buyout
  if (v === true) return "Выкуп"
  if (v === false) return "Не выкуп"
  return "—"
}

function RatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value))
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < v
        return (
          <Star
            key={i}
            className={cn("h-4 w-4", active ? "fill-orange-400 text-orange-400" : "text-muted-foreground")}
          />
        )
      })}
    </div>
  )
}

export default function DraftsTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  isLoading,
}: {
  rows: DraftRow[]
  selected: Set<number>
  onToggle: (id: number) => void
  onToggleAll: (checked: boolean) => void
  onOpen: (id: number) => void
  isLoading: boolean
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someChecked = rows.some((r) => selected.has(r.id)) && !allChecked

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => onToggleAll(v === true)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Товар</TableHead>
            <TableHead className="w-[160px]">Оценка</TableHead>
            <TableHead className="w-[140px]">Текст</TableHead>
            <TableHead className="w-[140px]">Статус</TableHead>
            <TableHead className="w-[140px]">Фотографии</TableHead>
            <TableHead className="w-[160px]" aria-sort="descending">
              Дата генерации
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                Загрузка...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const fb = r.feedback || ({} as any)
              const pd = fb.product_details || fb.raw?.productDetails || null

              const title = getProductTitle(pd)
              const brand = getBrand(pd)
              const art = getArticle(pd)
              const rating = Number(fb.product_valuation || 0)
              const hasText = !!(fb.text && String(fb.text).trim().length > 0)
              const photosCount = Array.isArray(fb.photo_links) ? fb.photo_links.length : 0
              const buyout = getBuyoutStatus(fb.raw)

              return (
                <TableRow key={r.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => onOpen(r.id)}>
                  <TableCell
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => onToggle(r.id)}
                      aria-label={`Select ${r.id}`}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
                        {fb.product_image_url ? (
                          <img
                            src={fb.product_image_url}
                            alt={title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground leading-snug line-clamp-1">{title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Wildberries{brand ? ` · ${brand}` : ""}
                          {art ? ` · ${art}` : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <RatingStars value={rating} />
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">{hasText ? "С текстом" : "Без текста"}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">{buyout}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">{photosCount > 0 ? String(photosCount) : "—"}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
