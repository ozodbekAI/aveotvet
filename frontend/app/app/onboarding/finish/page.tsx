"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { updateSettings } from "@/lib/api"
import { clearDraft, loadDraft, setSelectedShopId } from "@/lib/onboarding"

export default function OnboardingFinishPage() {
  const router = useRouter()
  const [draft, setDraft] = useState(() => loadDraft())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft.shop_id) router.replace("/app/onboarding")
  }, [draft.shop_id, router])

  const summary = useMemo(() => {
    const parts: Array<{ k: string; v: string }> = []
    parts.push({ k: "Магазин", v: draft.shop_name || `#${draft.shop_id}` })
    parts.push({ k: "Автоматизация", v: draft.automation_enabled ? "включена" : "выключена" })
    parts.push({ k: "Авто-синхронизация", v: draft.auto_sync ? "да" : "нет" })
    parts.push({ k: "Авто-черновики", v: draft.auto_draft ? "да" : "нет" })
    parts.push({ k: "Авто-публикация", v: draft.auto_publish ? "да" : "нет" })
    parts.push({ k: "Мин. рейтинг", v: `${draft.min_rating_to_autopublish} ★` })
    parts.push({ k: "Режим ответов", v: draft.reply_mode })
    parts.push({ k: "Тон", v: draft.tone })
    const sigCount = Object.entries(draft.signatures_by_brand || {}).filter(([_, v]) => typeof v === "string" && v.trim()).length
    parts.push({ k: "Подписи", v: sigCount ? `${sigCount} шт` : "нет" })
    return parts
  }, [draft])

  async function onSave() {
    if (!draft.shop_id) return
    setError(null)
    setLoading(true)
    try {
      const signatures = Object.entries(draft.signatures_by_brand || {})
        .map(([brand, text]) => {
          const t = (text || "").toString().trim()
          if (!t) return null
          return { text: t.slice(0, 300), type: "all", brand: (brand || "all").toString().trim() || "all", is_active: true }
        })
        .filter(Boolean)

      await updateSettings(draft.shop_id, {
        automation_enabled: draft.automation_enabled,
        auto_sync: draft.auto_sync,
        auto_draft: draft.auto_draft,
        auto_publish: draft.auto_publish,
        min_rating_to_autopublish: draft.min_rating_to_autopublish,
        reply_mode: draft.reply_mode,
        tone: draft.tone,
        // Use per-brand signatures (stored in signatures table)
        signatures,
        // Keep legacy field empty
        signature: null,
        config: {
          onboarding: {
            done: true,
            dashboard_intro_seen: false,
          },
        },
      })

      setSelectedShopId(draft.shop_id)
      clearDraft()
      router.replace("/app/dashboard")
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить настройки")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Готово — осталось сохранить</CardTitle>
        <CardDescription>Проверьте короткое резюме. После сохранения вы попадёте на Dashboard.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border">
          {summary.map((row, idx) => (
            <div key={row.k}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-sm text-muted-foreground">{row.k}</div>
                <div className="text-sm font-medium text-foreground">{row.v}</div>
              </div>
              {idx !== summary.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>

      <CardFooter className="flex items-center justify-end">
        <Button onClick={onSave} disabled={loading} className="rounded-2xl">
          {loading ? "Сохраняем…" : "Сохранить"}
        </Button>
      </CardFooter>
    </Card>
  )
}
