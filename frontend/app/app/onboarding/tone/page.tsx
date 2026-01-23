"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getShopBrands, getToneOptions } from "@/lib/api"
import { loadDraft, saveDraft } from "@/lib/onboarding"

type ToneOpt = { value: string; label: string; hint?: string }

export default function OnboardingTonePage() {
  const router = useRouter()
  const [draft, setDraft] = useState(() => loadDraft())
  const [options, setOptions] = useState<ToneOpt[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string>("all")

  useEffect(() => {
    if (!draft.shop_id) router.replace("/app/onboarding")
  }, [draft.shop_id, router])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await getToneOptions()
        if (mounted) setOptions(Array.isArray(data) ? data : [])
      } catch {
        if (mounted) setOptions([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!draft.shop_id) return
    ;(async () => {
      try {
        setBrandsLoading(true)
        const resp = await getShopBrands(draft.shop_id)
        const list = Array.isArray(resp?.data) ? resp.data : []
        if (mounted) setBrands(list)
      } catch {
        if (mounted) setBrands([])
      } finally {
        if (mounted) setBrandsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [draft.shop_id])

  const set = (patch: any) => {
    const next = saveDraft(patch)
    setDraft(next)
  }

  const brandOptions = useMemo(() => {
    const uniq = (brands || []).filter((b) => typeof b === "string" && b.trim())
    return ["all", ...uniq]
  }, [brands])

  const currentBrandSignature = useMemo(() => {
    const map = draft.signatures_by_brand || {}
    const v = map[selectedBrand]
    return typeof v === "string" ? v : ""
  }, [draft.signatures_by_brand, selectedBrand])

  const setBrandSignature = (brand: string, value: string) => {
    const map = { ...(draft.signatures_by_brand || {}) }
    if (value.trim()) {
      map[brand] = value
    } else {
      delete map[brand]
    }
    // Keep legacy field empty going forward
    set({ signatures_by_brand: map, signature: "" })
  }

  const removeBrandSignature = (brand: string) => {
    const map = { ...(draft.signatures_by_brand || {}) }
    delete map[brand]
    set({ signatures_by_brand: map, signature: "" })
  }

  const mergedOptions = useMemo(() => {
    const base = options.length
      ? options
      : [
          { value: "friendly", label: "Дружелюбный" },
          { value: "neutral", label: "Нейтральный" },
          { value: "formal", label: "Официальный" },
        ]
    if (base.some((x) => x.value === draft.tone)) return base
    return [{ value: draft.tone, label: draft.tone }, ...base]
  }, [options, draft.tone])

  return (
    <Card className="w-full rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Шаг 3 из 3 — Тон и подпись</CardTitle>
        <CardDescription>Выберите стиль ответов и добавьте подпись (по желанию).</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Тон ответов</Label>
          <Select value={draft.tone} onValueChange={(v) => set({ tone: v })}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder={loading ? "Загрузка…" : "Выберите тон"} />
            </SelectTrigger>
            <SelectContent>
              {mergedOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Этот тон будет использоваться при генерации ответов (его можно поменять в настройках).
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Подпись по брендам</Label>
            <div className="text-sm text-muted-foreground">
              Выберите бренд и добавьте подпись. Можно сделать подпись «для всех брендов».
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Бренд</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={brandsLoading ? "Загрузка…" : "Выберите бренд"} />
                </SelectTrigger>
                <SelectContent>
                  {brandOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b === "all" ? "Все бренды" : b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Текст подписи</Label>
              <Textarea
                value={currentBrandSignature}
                onChange={(e) => setBrandSignature(selectedBrand, e.target.value)}
                placeholder={selectedBrand === "all" ? "Например: С уважением, команда UNITY" : `Например: С уважением, бренд ${selectedBrand}`}
                className="min-h-[96px] rounded-2xl"
              />
              <div className="text-sm text-muted-foreground">Пусто — подпись для этого бренда не будет добавляться.</div>
            </div>
          </div>

          {/* Preview list */}
          {draft.signatures_by_brand && Object.keys(draft.signatures_by_brand).length ? (
            <div className="rounded-2xl border border-border p-3">
              <div className="mb-2 text-sm font-medium">Добавленные подписи</div>
              <div className="space-y-2">
                {Object.entries(draft.signatures_by_brand)
                  .filter(([_, v]) => typeof v === "string" && v.trim())
                  .map(([b, v]) => (
                    <div key={b} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{b === "all" ? "Все бренды" : b}</div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{v}</div>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-8 rounded-xl px-3"
                        onClick={() => removeBrandSignature(b)}
                        title="Удалить подпись"
                      >
                        Удалить
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end">
        <Button onClick={() => router.push("/app/onboarding/finish")} className="rounded-2xl">
          Далее
        </Button>
      </CardFooter>
    </Card>
  )
}
