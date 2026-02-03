"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, RefreshCw, Search, Sparkles, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"

import { generateQuestionDraft, getQuestion, listQuestions, publishQuestionAnswer, rejectQuestion, syncQuestions } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

type Section = "waiting" | "answered"

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

  const [section, setSection] = useState<Section>("waiting")
  const [q, setQ] = useState("")

  const [rows, setRows] = useState<QuestionListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const limit = 20
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  const [hasMore, setHasMore] = useState(true)
  const loadLockRef = useRef(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<QuestionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draftText, setDraftText] = useState<string>("")
  const [draftLoading, setDraftLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [currentDetailIndex, setCurrentDetailIndex] = useState<number>(0)

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
        const data = await listQuestions(shopId, {
          is_answered: section === "answered",
          q: q || undefined,
          limit,
          offset: nextOffset,
        })
        const list = (data || []) as QuestionListItem[]
        if (reset) {
          setRows(list)
          setOffsetSafe(limit)
          setHasMore(list.length === limit)
        } else {
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
        console.error("[questions] load failed:", e)
      } finally {
        setIsLoading(false)
        loadLockRef.current = false
      }
    },
    [shopId, section, q, setOffsetSafe],
  )

  useEffect(() => {
    if (!shopId) return
    setOffsetSafe(0)
    setHasMore(true)
    load(true)
  }, [shopId, section, q, load, setOffsetSafe])

  // Infinite scroll sentinel
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

  // Unanswered rows for processing
  const unansweredRows = useMemo(() => {
    return rows.filter((r) => !r.answer_text?.trim())
  }, [rows])

  const answeredCount = useMemo(() => {
    return rows.filter((r) => r.answer_text?.trim()).length
  }, [rows])

  async function handleSync() {
    if (!shopId) return
    try {
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

      await doOne(false)
      await doOne(true)
      load(true)
    } catch (e: any) {
      toast({
        title: "Синхронизация не запущена",
        description: e?.message || "Проверьте доступ и токен WB",
        variant: "destructive",
      })
    }
  }

  async function openDetail(wbId: string, index?: number) {
    if (!shopId) return
    
    if (typeof index === "number") {
      setCurrentDetailIndex(index)
    } else {
      const foundIndex = unansweredRows.findIndex((r) => r.wb_id === wbId)
      setCurrentDetailIndex(foundIndex >= 0 ? foundIndex : 0)
    }
    
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

  function startProcessing() {
    if (unansweredRows.length === 0) return
    openDetail(unansweredRows[0].wb_id, 0)
  }

  const goToPrev = useCallback(async () => {
    if (!shopId || currentDetailIndex <= 0) return
    const prevIndex = currentDetailIndex - 1
    const prevRow = unansweredRows[prevIndex]
    if (!prevRow) return
    
    setCurrentDetailIndex(prevIndex)
    setActiveId(prevRow.wb_id)
    setDetailLoading(true)
    setDraftText("")
    
    try {
      const d = await getQuestion(shopId, prevRow.wb_id)
      setDetail(d as any)
      setDraftText(String((d as any)?.answer_text || ""))
    } catch (e: any) {
      toast({ title: "Не удалось загрузить", description: e?.message || "", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }, [shopId, currentDetailIndex, unansweredRows, toast])

  const goToNext = useCallback(async () => {
    if (!shopId || currentDetailIndex >= unansweredRows.length - 1) return
    const nextIndex = currentDetailIndex + 1
    const nextRow = unansweredRows[nextIndex]
    if (!nextRow) return
    
    setCurrentDetailIndex(nextIndex)
    setActiveId(nextRow.wb_id)
    setDetailLoading(true)
    setDraftText("")
    
    try {
      const d = await getQuestion(shopId, nextRow.wb_id)
      setDetail(d as any)
      setDraftText(String((d as any)?.answer_text || ""))
    } catch (e: any) {
      toast({ title: "Не удалось загрузить", description: e?.message || "", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }, [shopId, currentDetailIndex, unansweredRows, toast])

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
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="text-lg font-semibold text-foreground">Магазин не выбран</div>
          <div className="text-sm text-muted-foreground mt-2">Выберите магазин, чтобы работать с вопросами.</div>
        </div>
      </div>
    )
  }

  const progressPercent = rows.length > 0 ? Math.round((answeredCount / rows.length) * 100) : 0

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Вопросы</h1>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <span>{answeredCount} из {rows.length} обработано</span>
            <Progress value={progressPercent} className="w-20 h-2" />
          </div>

          {/* Process button */}
          {section === "waiting" && unansweredRows.length > 0 && (
            <Button onClick={startProcessing} className="gap-2 bg-primary hover:bg-primary/90">
              <Play className="h-4 w-4" />
              Обработать ({unansweredRows.length})
            </Button>
          )}
        </div>

        <Button variant="outline" onClick={handleSync} disabled={isLoading || isPolling} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading || isPolling ? "animate-spin" : ""}`} />
          {isPolling ? "Синхронизация…" : "Синхронизировать"}
        </Button>
      </div>

      {pollError && <div className="text-sm text-destructive">{pollError}</div>}

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
          </div>

          <div className="relative w-[240px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по вопросам..."
              className="pl-9 rounded-xl h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {isLoading && rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка…</div>
          ) : rows.length ? (
            rows.map((it, idx) => (
              <Card key={it.wb_id} className="hover:bg-accent/10 transition-colors cursor-pointer" onClick={() => openDetail(it.wb_id, idx)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug line-clamp-1">{it.user_name || "Покупатель"}</CardTitle>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(it.created_date).toLocaleString()} {it.answer_text ? "· отвечено" : "· ожидает"}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(it.wb_id, idx); }}>
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
            <div className="p-8 text-center text-muted-foreground">Нет вопросов по выбранным фильтрам</div>
          )}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          
          {isLoading && rows.length > 0 && (
            <div className="p-4 text-center text-muted-foreground">Загрузка…</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Вопрос</DialogTitle>
              {section === "waiting" && unansweredRows.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrev}
                    disabled={currentDetailIndex <= 0 || detailLoading}
                  >
                    ← Назад
                  </Button>
                  <span>{currentDetailIndex + 1} / {unansweredRows.length}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNext}
                    disabled={currentDetailIndex >= unansweredRows.length - 1 || detailLoading}
                  >
                    Далее →
                  </Button>
                </div>
              )}
            </div>
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
