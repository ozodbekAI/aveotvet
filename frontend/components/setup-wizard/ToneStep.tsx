"use client"

import { Briefcase, Check, Heart, MessageSquare, Smile, Sparkles, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

type ToneOption = { value: string; label: string; hint?: string | null; example?: string | null }

interface ToneStepProps {
  selectedTone: string
  onSelectTone: (tone: string) => void
  tones?: ToneOption[]
  loading?: boolean
}

const fallbackTones: ToneOption[] = [
  {
    value: "none",
    label: "Без тональности",
    hint: "Настройка по умолчанию. Тональность отключена.",
    example: "Спасибо за отзыв!",
  },
  {
    value: "business",
    label: "Деловая",
    hint: "Официальный стиль ответа.",
    example: "Благодарим за обратную связь. Мы ценим ваше мнение.",
  },
  {
    value: "friendly",
    label: "Дружелюбная",
    hint: "Тёплый и доброжелательный тон.",
    example: "Спасибо за отзыв! Очень рады, что вам понравилось 😊",
  },
  {
    value: "joking",
    label: "Шутливая",
    hint: "Лёгкая шутка допустима, но без фамильярности.",
    example: "Спасибо! Будем стараться не только радовать, но и удивлять 😉",
  },
  {
    value: "serious",
    label: "Серьёзная",
    hint: "Строго и по делу.",
    example: "Спасибо за отзыв. Учтём замечания и улучшим качество.",
  },
  {
    value: "empathetic",
    label: "Эмпатичная",
    hint: "С сочувствием, акцент на понимание клиента.",
    example: "Спасибо, что написали. Нам очень жаль — мы разберёмся.",
  },
]

function iconFor(code: string) {
  const c = (code || "").toLowerCase()
  if (c.includes("business") || c.includes("office") || c.includes("pro")) return <Briefcase className="h-6 w-6" />
  if (c.includes("friendly") || c.includes("warm")) return <Heart className="h-6 w-6" />
  if (c.includes("jok") || c.includes("fun") || c.includes("spark")) return <Sparkles className="h-6 w-6" />
  if (c.includes("serious") || c.includes("formal")) return <GraduationCap className="h-6 w-6" />
  if (c.includes("empat") || c.includes("care") || c.includes("kind")) return <Smile className="h-6 w-6" />
  return <MessageSquare className="h-6 w-6" />
}

export function ToneStep({ selectedTone, onSelectTone, tones, loading }: ToneStepProps) {
  const list = (tones && tones.length ? tones : fallbackTones).map((t) => ({
    ...t,
    hint: t.hint ?? "",
    example: t.example ?? "",
  }))

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Выберите тон общения</h2>
        <p className="text-muted-foreground">Как ИИ будет обращаться к вашим покупателям</p>
        {loading ? <p className="text-xs text-muted-foreground mt-2">Загружаем варианты из базы…</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {list.map((t) => {
          const isSelected = selectedTone === t.value
          return (
            <div
              key={t.value}
              onClick={() => onSelectTone(t.value)}
              className={cn(
                "relative rounded-xl p-5 cursor-pointer border-2 transition-all",
                isSelected ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {iconFor(t.value)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.label}</h3>
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </div>
                  {t.hint ? <p className="text-sm text-muted-foreground">{t.hint}</p> : null}
                </div>
              </div>

              {t.example ? (
                <div className="text-sm italic text-muted-foreground bg-background/50 rounded-lg p-3">"{t.example}"</div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
