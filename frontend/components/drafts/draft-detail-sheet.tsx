"use client"

import * as React from "react"
import { ExternalLink, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { approveDraft, regenerateDraft, rejectDraft, updateDraft } from "@/lib/api"

function fmtDateTime(d?: string | null) {
  if (!d) return ""
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString("ru-RU")
}

function fmtDate(d?: string | null) {
  if (!d) return ""
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function safeText(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v)
  return s.trim() ? s : "—"
}

function getPD(raw: any) {
  return raw?.product_details || raw?.productDetails || raw?.raw?.productDetails || null
}

function getFeedback(raw: any) {
  return raw?.feedback || raw?.raw?.feedback || raw?.feedback_data || raw?.feedbackData || raw?.raw || null
}

function getNmId(pd: any) {
  return pd?.nmId ?? pd?.nm_id ?? pd?.nmID ?? null
}

function RatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value))
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const active = i < v
          return <Star key={i} className={active ? "h-4 w-4 fill-orange-400 text-orange-400" : "h-4 w-4 text-muted-foreground"} />
        })}
      </div>
    </div>
  )
}

export default function DraftDetailSheet({
  open,
  onOpenChange,
  shopId,
  draftId,
  data,
  loading,
  error,
  onAfterAction,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  shopId: number
  draftId: number | null
  data: any | null
  loading: boolean
  error: string | null
  onAfterAction?: () => void
}) {
  const { toast } = useToast()

  const fb = React.useMemo(() => getFeedback(data) || {}, [data])
  const pd = React.useMemo(() => getPD(fb) || {}, [fb])

  const productName = pd.productName || pd.product_name || pd.name || "Товар"
  const supplierOrBrand = pd.supplierName || pd.brandName || pd.brand || ""
  const nmId = getNmId(pd)
  const createdAt = data?.created_at || data?.createdAt || data?.generated_at || data?.generatedAt || null

  const productUrl = nmId ? `https://www.wildberries.ru/catalog/${nmId}/detail.aspx` : null
  const productImageUrl =
    fb?.product_image_url ||
    fb?.productImageUrl ||
    data?.product_image_url ||
    data?.productImageUrl ||
    null

  const reviewDate = fb?.created_date || fb?.createdDate || fb?.created_at || fb?.createdAt || null

  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [text, setText] = React.useState("")

  React.useEffect(() => {
    const t = data?.text ?? data?.answer_text ?? data?.answerText ?? ""
    setText(typeof t === "string" ? t : t == null ? "" : String(t))
    setEditing(false)
  }, [data, draftId])

  async function doSave() {
    if (!draftId) return
    setSaving(true)
    try {
      await updateDraft(shopId, draftId, { text })
      toast({ title: "Сохранено" })
      setEditing(false)
      onAfterAction?.()
    } catch (e: any) {
      toast({ title: "Не удалось сохранить", description: e?.message ?? "", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function doRegenerate() {
    if (!draftId) return
    setSaving(true)
    try {
      await regenerateDraft(shopId, draftId)
      toast({ title: "Перегенерация поставлена в очередь" })
      onOpenChange(false)
      onAfterAction?.()
    } catch (e: any) {
      toast({ title: "Не удалось перегенерировать", description: e?.message ?? "", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function doArchive() {
    if (!draftId) return
    setSaving(true)
    try {
      await rejectDraft(shopId, draftId)
      toast({ title: "Перемещено в архив" })
      onOpenChange(false)
      onAfterAction?.()
    } catch (e: any) {
      toast({ title: "Не удалось переместить", description: e?.message ?? "", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function doPublish() {
    if (!draftId) return
    setSaving(true)
    try {
      await approveDraft(shopId, draftId)
      toast({ title: "Опубликовано" })
      onOpenChange(false)
      onAfterAction?.()
    } catch (e: any) {
      toast({ title: "Не удалось опубликовать", description: e?.message ?? "", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(560px,98vw)] sm:max-w-[560px] p-0">
        {/* Header (like WB) */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{createdAt ? fmtDateTime(createdAt) : ""}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-purple-600 text-white text-[10px] font-bold">wb</span>
                <span className="truncate">
                  Wildberries{supplierOrBrand ? ` · ${supplierOrBrand}` : ""}
                  {nmId ? ` · Арт. ${nmId}` : ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-160px)] overflow-auto px-5 py-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Загрузка...</div>
          ) : error ? (
            <div className="py-10 text-center">
              <div className="text-sm font-medium text-destructive">Ошибка</div>
              <div className="mt-1 text-sm text-muted-foreground">{error}</div>
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Нет данных</div>
          ) : (
            <div className="space-y-4">
              {/* Product row */}
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0">
                  {productImageUrl ? (
                    <img
                      src={productImageUrl}
                      alt={productName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground line-clamp-2">{productName}</div>
                  {productUrl ? (
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      Перейти к товару <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Review card */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">Отзыв на товар</div>
                  <div className="text-xs text-muted-foreground">{reviewDate ? fmtDate(reviewDate) : ""}</div>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Оценка:</div>
                    <RatingStars value={Number(fb?.product_valuation || 0)} />
                  </div>

                  {/* buyout status if present */}
                  {fb?.raw?.buyout != null || fb?.raw?.isBuyout != null || fb?.raw?.is_buyout != null ? (
                    <div className="text-sm text-muted-foreground">
                      Статус: {fb?.raw?.buyout || fb?.raw?.isBuyout || fb?.raw?.is_buyout ? "Выкуп" : "Не выкуп"}
                    </div>
                  ) : null}

                  <div className="text-sm">
                    <div className="text-muted-foreground">Достоинства: <span className="text-foreground">{safeText(fb?.pros)}</span></div>
                    <div className="mt-1 text-muted-foreground">Недостатки: <span className="text-foreground">{safeText(fb?.cons)}</span></div>
                    <div className="mt-2 text-muted-foreground">Комментарий: <span className="text-foreground whitespace-pre-wrap">{safeText(fb?.text)}</span></div>
                  </div>
                </div>
              </div>

              {/* Answer card */}
              <div className="rounded-2xl border border-border bg-blue-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">Ответ на отзыв</div>
                  {!editing ? (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={saving}>
                      Редактировать
                    </Button>
                  ) : (
                    <Button size="sm" onClick={doSave} disabled={saving}>
                      Сохранить
                    </Button>
                  )}
                </div>

                <div className="mt-3">
                  {editing ? (
                    <>
                      <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        maxLength={5000}
                        className="bg-white"
                        placeholder="Текст ответа"
                      />
                      <div className="mt-1 text-right text-xs text-muted-foreground">{text.length}/5000</div>
                    </>
                  ) : (
                    <div className="text-sm text-foreground whitespace-pre-wrap">{safeText(text)}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-border px-5 py-4 bg-background">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={doRegenerate} disabled={saving || loading || !draftId}>
              Перегенерировать
            </Button>
            <Button variant="outline" onClick={doArchive} disabled={saving || loading || !draftId}>
              В архив
            </Button>
            <Button className="ml-auto" onClick={doPublish} disabled={saving || loading || !draftId}>
              Опубликовать
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
