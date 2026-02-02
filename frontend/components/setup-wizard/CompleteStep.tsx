"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, MessageSquare, HelpCircle, Rocket, Star, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getReviewPreviews } from "@/lib/api"

type PreviewItem = {
  kind: "negative" | "neutral" | "positive"
  rating: number
  review_text: string
  pros?: string | null
  cons?: string | null
  reply_text: string
}

// Static fallback examples when API call fails or OpenAI is not configured
const STATIC_EXAMPLES: PreviewItem[] = [
  {
    kind: "negative",
    rating: 1,
    review_text: "Заказ пришёл с браком. Упаковка помята, товар не работает как надо. Очень разочарован.",
    pros: null,
    cons: "Брак/не работает, упаковка помята",
    reply_text: "Здравствуйте! Искренне приносим извинения за доставленные неудобства. Нам очень важно качество каждого товара и мы сожалеем, что в данном случае Вы получили товар с браком. Пожалуйста, свяжитесь с нашей службой поддержки — мы оперативно решим вопрос с заменой или возвратом. Спасибо за обратную связь!",
  },
  {
    kind: "neutral",
    rating: 3,
    review_text: "Товар нормальный, но ожидал чуть лучше. Доставка была немного дольше обещанного.",
    pros: "В целом соответствует описанию",
    cons: "Доставка дольше, чем ожидал",
    reply_text: "Добрый день! Благодарим за отзыв. Рады, что товар в целом соответствует описанию. Примем к сведению замечание по срокам доставки и постараемся улучшить этот момент. Надеемся, что в следующий раз наш товар полностью оправдает Ваши ожидания!",
  },
  {
    kind: "positive",
    rating: 5,
    review_text: "Отличное качество! Всё подошло идеально, доставка быстрая. Спасибо!",
    pros: "Качество, скорость доставки",
    cons: null,
    reply_text: "Здравствуйте! Огромное спасибо за отличный отзыв! Мы очень рады, что товар Вам понравился и доставка порадовала своей оперативностью. Будем рады видеть Вас снова! 😊",
  },
]

interface CompleteStepProps {
  shopId?: number
  onFinish: () => void
  onSetupQuestions: () => void
  onSetupChats: () => void
}

function kindLabel(k: PreviewItem["kind"]) {
  if (k === "negative") return "Негативный отзыв"
  if (k === "neutral") return "Нейтральный отзыв"
  return "Положительный отзыв"
}

function StarsRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < rating ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-muted-foreground/30"} />
      ))}
    </div>
  )
}

export function CompleteStep({ shopId, onFinish, onSetupQuestions, onSetupChats }: CompleteStepProps) {
  const [loading, setLoading] = useState(false)
  const [usingFallback, setUsingFallback] = useState(true)
  // Start with static examples, then replace if API succeeds
  const [items, setItems] = useState<PreviewItem[]>(STATIC_EXAMPLES)

  useEffect(() => {
    if (!shopId) {
      // No shop - keep static examples
      setItems(STATIC_EXAMPLES)
      setUsingFallback(true)
      return
    }
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await getReviewPreviews(shopId)
        if (!mounted) return
        const fetchedItems = (res?.items || []) as PreviewItem[]
        if (fetchedItems.length > 0) {
          setItems(fetchedItems)
          setUsingFallback(false)
        } else {
          // Empty response - keep fallback
          setItems(STATIC_EXAMPLES)
          setUsingFallback(true)
        }
      } catch (e: any) {
        if (!mounted) return
        // On error - keep static examples
        setItems(STATIC_EXAMPLES)
        setUsingFallback(true)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [shopId])

  const hasPreviews = useMemo(() => items && items.length > 0, [items])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Настройка завершена ✅</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Мы выключили автогенерацию по умолчанию. Чтобы запустить/остановить работу воркера — используйте кнопку{" "}
          <span className="font-medium">«Запустить/Остановить»</span> вверху.
        </p>
      </div>

      {/* Примеры генерации */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              {loading ? "Примеры ответов (демонстрация)" : usingFallback ? "Примеры ответов (демонстрация)" : "Примеры ответов по вашим настройкам"}
            </div>
            <div className="text-xs text-muted-foreground">Негативный / Нейтральный / Положительный</div>
          </div>
          {loading ? <div className="text-xs text-muted-foreground animate-pulse">Загружаем персонализированные…</div> : null}
        </div>

        {usingFallback && !loading ? (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            Это демонстрационные примеры. Реальная генерация по вашим настройкам будет доступна после подключения ключа OpenAI.
          </div>
        ) : null}

        {hasPreviews ? (
          <div className="grid gap-4">
            {items.map((it, idx) => (
              <Card key={idx} className="border-border">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{kindLabel(it.kind)}</div>
                      <div className="mt-1">
                        <StarsRow rating={it.rating} />
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copy(it.reply_text)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Копировать
                    </Button>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="text-xs font-semibold mb-1">Отзыв</div>
                    <div className="text-sm whitespace-pre-wrap">{it.review_text}</div>
                    {it.pros ? <div className="mt-2 text-xs text-muted-foreground">Плюсы: {it.pros}</div> : null}
                    {it.cons ? <div className="mt-1 text-xs text-muted-foreground">Минусы: {it.cons}</div> : null}
                  </div>

                  <div className="rounded-lg bg-primary/5 border border-border p-3">
                    <div className="text-xs font-semibold mb-1">Ответ</div>
                    <div className="text-sm whitespace-pre-wrap">{it.reply_text}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !loading ? (
          null
        ) : null}
      </div>

      {/* Дополнительные настройки */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={onSetupQuestions}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Настроить Вопросы</h3>
                <p className="text-sm text-muted-foreground">Автоматизация ответов на вопросы покупателей</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={onSetupChats}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Настроить Чаты</h3>
                <p className="text-sm text-muted-foreground">Автоматизация общения в чатах маркетплейсов</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Кнопка завершения */}
      <div className="pt-2">
        <Button onClick={onFinish} size="lg" className="w-full">
          <Rocket className="h-4 w-4 mr-2" />
          Начать работу
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">Вы сможете вернуться к настройкам позже в разделе Настройки</p>
      </div>
    </div>
  )
}
