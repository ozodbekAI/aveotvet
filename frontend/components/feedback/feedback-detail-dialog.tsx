"use client"

import * as React from "react"

import { ExternalLink, Save, Send, Sparkles, Star, X } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useScrollLock } from "@/hooks/use-scroll-lock"

import {
  editFeedbackAnswer,
  generateFeedbackDraft,
  getLatestFeedbackDraft,
  publishFeedbackAnswer,
  updateDraft,
} from "@/lib/api"

export type FeedbackDetail = {
  wb_id: string
  created_date: string
  product_valuation?: number | null
  user_name?: string | null
  text?: string | null
  pros?: string | null
  cons?: string | null
  was_viewed?: boolean | null
  answer_text?: string | null
  answer_editable?: boolean | null
  product_details?: any | null
  photo_links?: string[] | null
  video?: any | null
  bables?: string[] | null
  raw?: any | null
}

function fmtDateTime(d: string) {
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return d
    return dt.toLocaleString("ru-RU")
  } catch {
    return d
  }
}

function safeText(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v)
  return s.trim() ? s.trim() : "—"
}

function getPd(data: FeedbackDetail) {
  return data.product_details || data.raw?.productDetails || null
}

function getNmId(data: FeedbackDetail) {
  const pd = getPd(data)
  return pd?.nmId || data.raw?.nmId || null
}

function ratingValue(data: FeedbackDetail) {
  const v = Number(data.product_valuation ?? 0)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(5, Math.round(v)))
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < value
        return (
          <Star
            key={i}
            className={active ? "h-4 w-4 text-primary fill-primary" : "h-4 w-4 text-muted-foreground/30"}
          />
        )
      })}
    </div>
  )
}

export default function FeedbackDetailDialog({
  open,
  onOpenChange,
  shopId,
  data,
  loading,
  error,
  onReload,
  onPublished,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  shopId: number | null
  data: FeedbackDetail | null
  loading: boolean
  error: string | null
  onReload?: () => Promise<void> | void
  onPublished?: () => Promise<void> | void
}) {
  const { toast } = useToast()
  useScrollLock(open)

  const [answerText, setAnswerText] = React.useState("")
  const [draftId, setDraftId] = React.useState<number | null>(null)
  const [action, setAction] = React.useState<"draft" | "save" | "publish" | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const isAnswered = Boolean((data?.answer_text || "").trim())

  React.useEffect(() => {
    if (!open) return
    setActionError(null)

    // If the feedback already has a published answer, display it.
    const published = (data?.answer_text || "").toString()
    if (published.trim()) {
      setAnswerText(published)
      setDraftId(null)
      return
    }

    // No published answer: try to load the latest draft (auto-generated or previously created).
    setAnswerText("")
    setDraftId(null)
    if (!shopId || !data?.wb_id) return

    ;(async () => {
      try {
        const d = await getLatestFeedbackDraft(shopId, data.wb_id)
        if (!d?.text) return
        // Guard: don't override if the user already typed something while we were loading.
        setAnswerText((prev) => (prev.trim() ? prev : d.text))
        setDraftId(d.draft_id ?? null)
      } catch {
        // no draft yet -> ignore
      }
    })()
  }, [open, shopId, data?.wb_id, data?.answer_text])

  const pd = data ? getPd(data) : null
  const nmId = data ? getNmId(data) : null
  const brandName = pd?.brandName || pd?.brand || ""
  const productName = pd?.productName || pd?.name || "Товар"
  const sizeText = pd?.size || "—"
  const colorText = data?.raw?.color || "—"

  const canAct = Boolean(shopId && data)

  const doDraft = async () => {
    if (!shopId || !data) return
    setAction("draft")
    setActionError(null)
    try {
      const res = await generateFeedbackDraft(shopId, data.wb_id)
      if (res?.text) setAnswerText(res.text)
      if (typeof res?.draft_id === "number") setDraftId(res.draft_id)
      toast({ title: "Черновик сгенерирован", description: "Проверьте текст и при необходимости отредактируйте." })
      await onReload?.()
    } catch (e: any) {
      const msg = e?.message || "Не удалось сгенерировать черновик"
      setActionError(msg)
      toast({ title: "Ошибка", description: msg, variant: "destructive" })
    } finally {
      setAction(null)
    }
  }

  const doSave = async () => {
    if (!shopId || !data) return
    setAction("save")
    setActionError(null)
    try {
      if (isAnswered) {
        await editFeedbackAnswer(shopId, data.wb_id, answerText)
        toast({ title: "Сохранено", description: "Ответ обновлён в Wildberries." })
        await onReload?.()
      } else {
        if (!draftId) {
          throw new Error("Нет черновика: сначала нажмите «Сгенерировать»")
        }
        await updateDraft(shopId, draftId, { text: answerText })
        toast({ title: "Сохранено", description: "Черновик обновлён." })
      }
    } catch (e: any) {
      const msg = e?.message || "Не удалось сохранить"
      setActionError(msg)
      toast({ title: "Ошибка", description: msg, variant: "destructive" })
    } finally {
      setAction(null)
    }
  }

  const doPublish = async () => {
    if (!shopId || !data) return
    setAction("publish")
    setActionError(null)
    try {
      if (isAnswered) {
        await editFeedbackAnswer(shopId, data.wb_id, answerText)
        toast({ title: "Обновлено", description: "Ответ обновлён в Wildberries." })
        await onPublished?.()
      } else {
        await publishFeedbackAnswer(shopId, data.wb_id, answerText)
        if (draftId) {
          // best-effort: mark draft as published for better audit in Drafts tab
          try {
            await updateDraft(shopId, draftId, { status: "published" })
          } catch {
            // ignore
          }
        }
        toast({ title: "Опубликовано", description: "Ответ отправлен на Wildberries." })
        await onPublished?.()
      }
    } catch (e: any) {
      const msg = e?.message || "Не удалось опубликовать"
      setActionError(msg)
      toast({ title: "Ошибка", description: msg, variant: "destructive" })
    } finally {
      setAction(null)
    }
  }

  const headerMeta = (
    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
      {brandName ? <span>{brandName}</span> : null}
      {brandName && nmId ? <span>·</span> : null}
      {nmId ? <span>#{nmId}</span> : null}
    </div>
  )

  const reviewNode = !data ? null : (
    <div className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Детали</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <RatingStars value={ratingValue(data)} />
              <div className="text-sm font-semibold text-foreground">{Number(data.product_valuation || 0) || 0}/5</div>
            </div>

            {nmId ? (
              <a
                href={`https://www.wildberries.ru/catalog/${nmId}/detail.aspx`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть на WB
              </a>
            ) : null}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Покупатель</div>
              <div className="font-medium text-foreground">{safeText(data.user_name)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Дата</div>
              <div className="font-medium text-foreground">{fmtDateTime(data.created_date)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Размер</div>
              <div className="font-medium text-foreground">{safeText(sizeText)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Цвет</div>
              <div className="font-medium text-foreground">{safeText(colorText)}</div>
            </div>
          </div>

          {Array.isArray(data.bables) && data.bables.length > 0 ? (
            <>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-2">Характеристики</div>
                <div className="flex flex-wrap gap-2">
                  {data.bables.slice(0, 24).map((t, i) => (
                    <Badge key={`${t}-${i}`} variant="secondary" className="max-w-full truncate rounded-xl">
                      {String(t)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Текст отзыва</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-foreground whitespace-pre-wrap break-words">{safeText(data.text)}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="text-xs font-semibold text-foreground">Плюсы</div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{safeText(data.pros)}</div>
            </div>
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="text-xs font-semibold text-foreground">Минусы</div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{safeText(data.cons)}</div>
            </div>
          </div>

          {!!(data.photo_links && data.photo_links.length) ? (
            <>
              <Separator />
              <div>
                <div className="text-xs font-semibold text-foreground mb-2">Фото ({data.photo_links.length})</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {data.photo_links.slice(0, 12).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={url} alt={`photo-${i}`} className="h-20 w-full object-cover rounded-xl border border-border" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )

  const answerNode = !data ? null : (
    <div className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ответ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Статус: {data.answer_text ? "Отвечено" : "Ожидает ответа"}
          </div>

          <Textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Напишите ответ или сгенерируйте черновик"
            className="min-h-[160px] rounded-xl"
            disabled={!canAct || action === "publish"}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Символов: {answerText.length}</span>
            {actionError ? <span className="text-destructive">{actionError}</span> : <span />}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={doDraft} disabled={!canAct || action !== null || isAnswered} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Сгенерировать
            </Button>

            <Button variant="outline" onClick={doSave} disabled={!canAct || action !== null || !answerText.trim()} className="gap-2">
              <Save className="h-4 w-4" />
              Сохранить
            </Button>

            <Button onClick={doPublish} disabled={!canAct || action !== null || !answerText.trim()} className="gap-2">
              <Send className="h-4 w-4" />
              {isAnswered ? "Обновить" : "Опубликовать"}
            </Button>
          </div>

          {!canAct ? (
            <div className="text-xs text-muted-foreground">
              Действия недоступны: выберите магазин и убедитесь, что у роли есть права на ответы.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Подсказка</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Рекомендуется сохранять черновик перед публикацией. При автогенерации учитывается баланс магазина и лимиты в настройках.
        </CardContent>
      </Card>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[96vw] max-w-4xl
          sm:w-[96vw] sm:max-w-4xl
          h-[85vh] max-h-[85vh]
          overflow-hidden
          p-0
          grid grid-rows-[auto,1fr]
          gap-0
        "
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Отзыв</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div>
          <div className="h-1 wb-accent-bar" />
          <div className="flex items-start justify-between gap-4 px-5 py-4 bg-card">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/10 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Отзыв</div>
                <div className="text-lg font-semibold leading-snug line-clamp-2 text-foreground">{data ? productName : "—"}</div>
                {data ? headerMeta : null}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 h-full overflow-y-auto p-4">

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : error ? (
            <div className="py-10 text-center">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Нет данных</div>
          ) : (
            <>
              {/* Mobile: tabs to avoid "long" ugly column */}
              <div className="lg:hidden">
                <Tabs defaultValue="review" className="w-full">
                  <TabsList className="w-full rounded-xl bg-muted/60">
                    <TabsTrigger value="review" className="flex-1 rounded-lg">
                      Отзыв
                    </TabsTrigger>
                    <TabsTrigger value="answer" className="flex-1 rounded-lg">
                      Ответ
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="review" className="mt-4">
                    {reviewNode}
                  </TabsContent>
                  <TabsContent value="answer" className="mt-4">
                    {answerNode}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Desktop: comfortable two-column */}
              <div className="hidden lg:grid grid-cols-12 gap-5 items-start">
                <div className="col-span-7">{reviewNode}</div>
                <div className="col-span-5 lg:sticky lg:top-5 self-start">{answerNode}</div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}