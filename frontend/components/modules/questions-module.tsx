"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, Sparkles, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

import { generateQuestionDraft, getQuestion, listQuestions, publishQuestionAnswer, rejectQuestion, syncQuestions } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

type FilterAnswered = "all" | "unanswered" | "answered"

type QuestionListItem = {
  wb_id: string
  created_date: string
  user_name?: string | null
  text?: string | null
  was_viewed?: boolean
  answer_text?: string | null
  product_details?: any
}

type QuestionDetail = QuestionListItem & { raw?: any; state?: string | null }

export default function QuestionsModule({ shopId }: { shopId: number | null }) {
  const { toast } = useToast()
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const [q, setQ] = useState("")
  const [answered, setAnswered] = useState<FilterAnswered>("unanswered")

  const [rows, setRows] = useState<QuestionListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const limit = 20
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<QuestionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draftText, setDraftText] = useState<string>("")
  const [draftLoading, setDraftLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)

  const isAnsweredParam = useMemo(() => {
    if (answered === "all") return undefined
    return answered === "answered"
  }, [answered])

  async function load(reset = false) {
    if (!shopId) return
    setIsLoading(true)
    try {
      const nextOffset = reset ? 0 : offset
      const data = await listQuestions(shopId, {
        is_answered: isAnsweredParam,
        q: q || undefined,
        limit,
        offset: nextOffset,
      })
      const list = (data || []) as QuestionListItem[]
      if (reset) {
        setRows(list)
        setOffset(limit)
      } else {
        setRows((prev) => [...prev, ...list])
        setOffset((prev) => prev + limit)
      }
      setHasMore(list.length === limit)
    } catch (e) {
      console.error("[questions] load failed:", e)
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
  }, [shopId, q, answered])

  async function handleSync() {
    if (!shopId) return
    try {
      // Backend requires explicit is_answered flag.
      // For "all" we sync both unanswered and answered sequentially.
      const doOne = async (isAnswered: boolean) => {
        const res = await syncQuestions(shopId, {
          is_answered: isAnswered,
          take: 500,
          skip: 0,
          order: "dateDesc",
        })
        if (res?.job_id) {
          return new Promise<void>((resolve) => {
            pollJob(res.job_id, () => {
              resolve()
            })
          })
        }
      }

      if (isAnsweredParam === undefined) {
        await doOne(false)
        await doOne(true)
        load(true)
      } else {
        await doOne(Boolean(isAnsweredParam))
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

  async function openDetail(wbId: string) {
    if (!shopId) return
    setOpen(true)
    setActiveId(wbId)
    setDetail(null)
    setDraftText("")
    setDetailLoading(true)
    try {
      const d = (await getQuestion(shopId, wbId)) as any
      setDetail(d)
      setDraftText(String(d?.answer_text || ""))
    } catch (e: any) {
      toast({ title: "Не удалось загрузить вопрос", description: e?.message || "", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleDraft() {
    if (!shopId || !activeId) return
    setDraftLoading(true)
    try {
      const res = await generateQuestionDraft(shopId, activeId)
      if (res?.text) setDraftText(String(res.text))
      toast({ title: "Черновик создан", description: "Проверьте текст и опубликуйте, если всё верно." })
    } catch (e: any) {
      toast({
        title: "Не удалось создать черновик",
        description: e?.message || "Проверьте баланс магазина",
        variant: "destructive",
      })
    } finally {
      setDraftLoading(false)
    }
  }

  async function handlePublish() {
    if (!shopId || !activeId) return
    setPublishLoading(true)
    try {
      await publishQuestionAnswer(shopId, activeId, draftText)
      toast({ title: "Ответ опубликован" })
      setOpen(false)
      load(true)
    } catch (e: any) {
      toast({ title: "Публикация не выполнена", description: e?.message || "", variant: "destructive" })
    } finally {
      setPublishLoading(false)
    }
  }

  async function handleReject() {
    if (!shopId || !activeId) return
    setPublishLoading(true)
    try {
      await rejectQuestion(shopId, activeId)
      toast({ title: "Вопрос отклонён" })
      setOpen(false)
      load(true)
    } catch (e: any) {
      toast({ title: "Не удалось отклонить", description: e?.message || "", variant: "destructive" })
    } finally {
      setPublishLoading(false)
    }
  }

  if (!shopId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="text-lg font-semibold text-foreground">Магазин не выбран</div>
          <div className="text-sm text-muted-foreground mt-2">Выберите магазин, чтобы работать с вопросами.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-foreground">Вопросы покупателей</div>
          {pollError && <div className="text-sm text-destructive mt-1">{pollError}</div>}
        </div>

        <Button variant="outline" onClick={handleSync} disabled={isLoading || isPolling} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading || isPolling ? "animate-spin" : ""}`} />
          {isPolling ? "Синхронизация…" : "Синхронизировать"}
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-[340px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по тексту или товару" className="pl-9" />
        </div>

        <Select value={answered} onValueChange={(v) => setAnswered(v as FilterAnswered)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unanswered">Ожидают ответа</SelectItem>
            <SelectItem value="answered">Отвеченные</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>
        ) : rows.length ? (
          rows.map((it) => (
            <Card key={it.wb_id} className="hover:bg-accent/10 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-snug line-clamp-1">{it.user_name || "Покупатель"}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(it.created_date).toLocaleString()} {it.answer_text ? "· отвечено" : "· ожидает"}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDetail(it.wb_id)}>
                    Открыть
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground line-clamp-2">{it.text || ""}</div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-muted-foreground">Нет вопросов по выбранным фильтрам</Card>
        )}
      </div>

      <div className="flex items-center justify-end">
        <Button variant="outline" disabled={!hasMore || isLoading} onClick={() => load(false)}>
          {hasMore ? "Загрузить ещё" : "Больше нет"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Вопрос</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка…</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Покупатель</div>
                <div className="text-sm font-medium text-foreground">{detail.user_name || "—"}</div>
                <div className="text-xs text-muted-foreground mt-2">Вопрос</div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{detail.text || ""}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">Ответ</div>
                  <Button variant="outline" size="sm" onClick={handleDraft} disabled={draftLoading || publishLoading} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {draftLoading ? "Генерация…" : "Сгенерировать"}
                  </Button>
                </div>
                <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={8} />
                <div className="text-xs text-muted-foreground">Макс. 5000 символов. Пожалуйста, проверяйте факты перед публикацией.</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Нет данных</div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={publishLoading || detailLoading || !detail}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Отклонить
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={publishLoading}>
                Закрыть
              </Button>
              <Button onClick={handlePublish} disabled={publishLoading || detailLoading || !detail || !draftText.trim()}>
                {publishLoading ? "Публикация…" : "Опубликовать"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
