"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { loadDraft, saveDraft } from "@/lib/onboarding"

export default function OnboardingAutomationPage() {
  const router = useRouter()

  const [draft, setDraft] = useState(() => loadDraft())

  useEffect(() => {
    if (!draft.shop_id) {
      router.replace("/app/onboarding")
    }
  }, [draft.shop_id, router])

  const set = (patch: any) => {
    const next = saveDraft(patch)
    setDraft(next)
  }

  const row = (title: string, desc: string, checked: boolean, onCheckedChange: (v: boolean) => void, disabled?: boolean) => {
    return (
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/50 p-4">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{title}</div>
          <div className="text-sm text-muted-foreground">{desc}</div>
        </div>
        <div className="pt-1">
          <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Шаг 1 из 3 — Автоматизация</CardTitle>
        <CardDescription>Сначала включаем/выключаем автоматические действия. Всё можно поменять позже в «Настройках».</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Главный переключатель</Label>
          {row(
            "Автоматизация включена",
            "Если выключить — система будет только показывать отзывы, без авто-драфтов и авто-публикации.",
            draft.automation_enabled,
            (v) => set({ automation_enabled: v }),
          )}
        </div>

        <div className="space-y-2">
          <Label>Действия</Label>
          {row(
            "Авто-синхронизация",
            "Регулярно подтягивать новые отзывы/вопросы из WB.",
            draft.auto_sync,
            (v) => set({ auto_sync: v }),
            !draft.automation_enabled,
          )}
          {row(
            "Авто-черновики",
            "Автоматически создавать черновики ответов.",
            draft.auto_draft,
            (v) => set({ auto_draft: v }),
            !draft.automation_enabled,
          )}
          {row(
            "Авто-публикация",
            "Автоматически публиковать ответы по правилам рейтинга.",
            draft.auto_publish,
            (v) => set({ auto_publish: v }),
            !draft.automation_enabled,
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end">
        <Button onClick={() => router.push("/app/onboarding/reviews")} className="rounded-2xl">
          Далее
        </Button>
      </CardFooter>
    </Card>
  )
}
