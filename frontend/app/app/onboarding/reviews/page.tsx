"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadDraft, saveDraft } from "@/lib/onboarding"

export default function OnboardingReviewsPage() {
  const router = useRouter()
  const [draft, setDraft] = useState(() => loadDraft())

  useEffect(() => {
    if (!draft.shop_id) router.replace("/app/onboarding")
  }, [draft.shop_id, router])

  const set = (patch: any) => {
    const next = saveDraft(patch)
    setDraft(next)
  }

  return (
    <Card className="w-full rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Шаг 2 из 3 — Правила отзывов</CardTitle>
        <CardDescription>
          Здесь задаём, когда можно авто-публиковать, и как будет вести себя бот. Можно поменять позже.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Минимальный рейтинг для авто-публикации</Label>
          <Select
            value={String(draft.min_rating_to_autopublish)}
            onValueChange={(v) => set({ min_rating_to_autopublish: Number.parseInt(v, 10) })}
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Выберите рейтинг" />
            </SelectTrigger>
            <SelectContent>
              {[5, 4, 3, 2, 1].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r} ★ и выше
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Пример: если выбрано <b>5 ★</b>, система будет авто-публиковать только для 5★ (остальные — черновик/ручной).
          </div>
        </div>

        <div className="space-y-2">
          <Label>Режим ответов</Label>
          <RadioGroup
            value={draft.reply_mode}
            onValueChange={(v) => set({ reply_mode: v })}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <RadioGroupItem value="manual" id="rm_manual" className="mt-1" />
              <label htmlFor="rm_manual" className="space-y-1 cursor-pointer">
                <div className="font-medium text-foreground">Ручной</div>
                <div className="text-sm text-muted-foreground">Ничего не публикуем автоматически — вы решаете всё сами.</div>
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <RadioGroupItem value="semi" id="rm_semi" className="mt-1" />
              <label htmlFor="rm_semi" className="space-y-1 cursor-pointer">
                <div className="font-medium text-foreground">Полуавтомат</div>
                <div className="text-sm text-muted-foreground">
                  Авто-создаём черновик, а публикуете вы (или авто-публикация по рейтингу).
                </div>
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-border p-4">
              <RadioGroupItem value="auto" id="rm_auto" className="mt-1" />
              <label htmlFor="rm_auto" className="space-y-1 cursor-pointer">
                <div className="font-medium text-foreground">Полный авто</div>
                <div className="text-sm text-muted-foreground">Авто-черновик + авто-публикация (по правилам рейтинга).</div>
              </label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end">
        <Button onClick={() => router.push("/app/onboarding/tone")} className="rounded-2xl">
          Далее
        </Button>
      </CardFooter>
    </Card>
  )
}
