"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createShop } from "@/lib/api"
import { loadDraft, saveDraft, setSelectedShopId } from "@/lib/onboarding"

export default function OnboardingAddShopPage() {
  const router = useRouter()

  const initial = useMemo(() => loadDraft(), [])
  const [name, setName] = useState<string>(initial.shop_name || "")
  const [token, setToken] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If user already created a shop in this wizard, let them continue.
    if (initial.shop_id) {
      router.replace("/app/onboarding/automation")
    }
  }, [initial.shop_id, router])

  const canContinue = name.trim().length > 0 && token.trim().length > 0

  async function onNext() {
    setError(null)
    if (!canContinue) {
      setError("Введите название магазина и токен WB")
      return
    }

    setLoading(true)
    try {
      const shop = await createShop({ name: name.trim(), wb_token: token.trim() })
      saveDraft({ shop_id: shop.id, shop_name: shop.name })
      setSelectedShopId(shop.id)
      router.push("/app/onboarding/automation")
    } catch (e: any) {
      setError(e?.message || "Не удалось создать магазин")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Добавьте магазин</CardTitle>
        <CardDescription>
          Это займёт 1–2 минуты. Сначала создаём магазин, потом пошагово настроим автоматические ответы.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="shop_name">Название магазина</Label>
          <Input
            id="shop_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: UNITY"
            className="rounded-2xl"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wb_token">WB token</Label>
          <Input
            id="wb_token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Вставьте токен"
            className="rounded-2xl"
            type="password"
          />

          <Accordion type="single" collapsible className="rounded-2xl border border-border">
            <AccordionItem value="token" className="border-none">
              <AccordionTrigger className="px-4">Где взять токен?</AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Откройте личный кабинет Wildberries для продавцов.</li>
                  <li>Перейдите в раздел настроек / доступ к API.</li>
                  <li>Создайте (или скопируйте) API-токен и вставьте его сюда.</li>
                </ol>
                <div className="mt-2">Токен хранится у нас в зашифрованном виде.</div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>

      <CardFooter className="flex items-center justify-end">
        <Button onClick={onNext} disabled={!canContinue || loading} className="rounded-2xl">
          {loading ? "Создаём…" : "Далее"}
        </Button>
      </CardFooter>
    </Card>
  )
}
