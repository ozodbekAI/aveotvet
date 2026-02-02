"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"

import { WizardProgress } from "./WizardProgress"
import { WizardNavigation } from "./WizardNavigation"
import { ConnectionStep } from "./ConnectionStep"
import { RatingsStep } from "./RatingsStep"
import { ToneStep } from "./ToneStep"
import { BrandsStep } from "./BrandsStep"
import { ResponseStyleStep } from "./ResponseStyleStep"
import { CompleteStep } from "./CompleteStep"
import { ModeStep } from "./ModeStep"

import type { ResponseStyleConfig, SignatureItem, WizardStep, RatingMode, AutomationMode } from "./types"
import { createShop, getToneOptions, updateSettings, verifyWbToken, listShops, getShop } from "@/lib/api"
import { setSelectedShopId, SELECTED_SHOP_KEY } from "@/lib/onboarding"

type RatingModes = Record<number, RatingMode>

type WizardState = {
  currentStep: WizardStep
  completedSteps: WizardStep[]

  // shop
  storeConnected: boolean
  storeName: string
  token: string
  isTokenValid: boolean
  shopId: number | null

  // automation mode
  automationMode: AutomationMode | null

  // settings
  ratingModes: RatingModes
  tone: string
  signatures: SignatureItem[]
  responseStyle: ResponseStyleConfig
}

const STORAGE_KEY = "wb_otveto_setup_wizard_v2"

const STEPS_ORDER: WizardStep[] = [
  "connection",
  "mode",
  "ratings",
  "tone",
  "brands",
  "responseStyle",
  "complete",
]

function defaultRatingModes(): RatingModes {
  // Match backend default: 1-2 manual, 3 draft, 4-5 auto
  return { 1: "manual", 2: "manual", 3: "semi", 4: "auto", 5: "auto" }
}

function defaultResponseStyle(): ResponseStyleConfig {
  return {
    addressForm: "formal-you",
    useCustomerName: true,
    useEmoji: true,
    responseLength: "default",
  }
}

function defaultState(): WizardState {
  return {
    currentStep: "connection",
    completedSteps: [],

    storeConnected: false,
    storeName: "",
    token: "",
    isTokenValid: false,
    shopId: null,

    automationMode: null,

    ratingModes: defaultRatingModes(),
    tone: "none",
    signatures: [],
    responseStyle: defaultResponseStyle(),
  }
}

function normalizeSignatures(raw: any): SignatureItem[] {
  if (!Array.isArray(raw)) return []

  const out: SignatureItem[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim()
      if (t) out.push({ text: t, type: "all", brand: "all", is_active: true })
      continue
    }
    if (item && typeof item === "object") {
      const text = String((item as any).text || "").trim()
      if (!text) continue
      const typeRaw = String((item as any).type || "all").trim().toLowerCase()
      const type = (typeRaw === "review" || typeRaw === "question" || typeRaw === "chat" ? typeRaw : "all") as any
      const brand = String((item as any).brand || "all").trim() || "all"
      const is_active = typeof (item as any).is_active === "boolean" ? (item as any).is_active : true
      out.push({ text, type, brand, is_active })
      continue
    }
  }

  // de-dup by (brand|type|text)
  const seen = new Set<string>()
  const uniq: SignatureItem[] = []
  for (const s of out) {
    const k = `${s.brand.toLowerCase()}|${s.type}|${s.text.toLowerCase()}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(s)
  }
  return uniq
}

function uniqSteps(xs: WizardStep[]) {
  return Array.from(new Set(xs))
}

function nextStepOf(step: WizardStep): WizardStep {
  const i = STEPS_ORDER.indexOf(step)
  return STEPS_ORDER[Math.min(i + 1, STEPS_ORDER.length - 1)]
}

function prevStepOf(step: WizardStep): WizardStep {
  const i = STEPS_ORDER.indexOf(step)
  return STEPS_ORDER[Math.max(i - 1, 0)]
}

type ToneOption = { value: string; label: string; hint?: string | null; example?: string | null }

function mapAddressFormat(x: ResponseStyleConfig["addressForm"]) {
  if (x === "formal-you") return "vy_caps"
  if (x === "informal-you") return "vy_lower"
  return "ty"
}

export function SetupWizard() {
  const router = useRouter()
  
  // Check if this is a "new shop" flow (from + button)
  const [isNewShopFlow, setIsNewShopFlow] = useState(false)
  
  useEffect(() => {
    // Check URL for new=1 param
    const params = new URLSearchParams(window.location.search)
    if (params.get("new") === "1") {
      setIsNewShopFlow(true)
      // Clear any saved wizard state for fresh start
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      // Remove param from URL without reload
      const url = new URL(window.location.href)
      url.searchParams.delete("new")
      window.history.replaceState({}, "", url.pathname)
    }
  }, [])

  const [state, setState] = useState<WizardState>(() => defaultState())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dynamic tones from DB (via backend prompt bundle)
  const [toneOptions, setToneOptions] = useState<ToneOption[]>([])
  const [toneLoading, setToneLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setToneLoading(true)
      try {
        const opts = await getToneOptions()
        if (!mounted) return
        const arr = Array.isArray(opts) ? (opts as any[]) : []
        setToneOptions(
          arr
            .map((x) => ({
              value: String(x?.value || "").trim(),
              label: String(x?.label || "").trim(),
              hint: x?.hint ?? null,
              example: x?.example ?? null,
            }))
            .filter((x) => x.value && x.label)
        )
      } catch {
        // keep fallback UI inside ToneStep
      } finally {
        if (mounted) setToneLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // If DB tones loaded and current tone is unknown — select first available.
  useEffect(() => {
    if (!toneOptions.length) return
    const exists = toneOptions.some((t) => t.value === state.tone)
    if (!exists) {
      setState((p) => ({ ...p, tone: toneOptions[0]!.value }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toneOptions.length])

  // Load existing shop if user has one and is re-running onboarding
  // Skip this if user clicked "+" to add a new shop
  useEffect(() => {
    // If this is a new shop flow, don't load existing shop
    if (isNewShopFlow) return
    
    let mounted = true
    ;(async () => {
      // Check if we already have shopId from state (restored from localStorage)
      if (state.shopId) return

      // Try to get selected shop from localStorage
      const savedShopId = typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_SHOP_KEY) : null
      const shopId = savedShopId ? Number.parseInt(savedShopId, 10) : null
      
      if (shopId && Number.isFinite(shopId)) {
        try {
          const shop = await getShop(shopId)
          if (!mounted) return
          if (shop) {
            // User has existing shop - pre-fill connection step
            setState((prev) => ({
              ...prev,
              shopId: shop.id,
              storeConnected: true,
              storeName: shop.name || "",
              isTokenValid: true,
              // Skip connection step for existing shops
              currentStep: prev.currentStep === "connection" ? "mode" : prev.currentStep,
              completedSteps: prev.completedSteps.includes("connection") 
                ? prev.completedSteps 
                : [...prev.completedSteps, "connection"],
            }))
          }
        } catch {
          // Shop not found or not accessible - user needs to create new one
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [isNewShopFlow])

  // Restore from localStorage (skip if new shop flow)
  useEffect(() => {
    if (isNewShopFlow) return
    
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return

      // Very defensive restore (avoid breaking onboarding if schema changes)
      setState((prev) => {
        const next: WizardState = {
          ...prev,
          ...parsed,
          // keep defaults for nested pieces
          ratingModes: { ...defaultRatingModes(), ...(parsed.ratingModes || {}) },
          responseStyle: { ...defaultResponseStyle(), ...(parsed.responseStyle || {}) },
          completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : prev.completedSteps,
        }
        // Normalize signatures (supports legacy formats: string[] and old "brands" field)
        const sigRaw = (parsed as any)?.signatures
        const legacyBrands = (parsed as any)?.brands
        const normalized = normalizeSignatures(sigRaw)
        const normalizedLegacy = normalized.length ? normalized : normalizeSignatures(legacyBrands)
        next.signatures = normalizedLegacy

        if (!STEPS_ORDER.includes(next.currentStep)) next.currentStep = "connection"
        return next
      })
    } catch {
      // ignore restore errors
    }
  }, [])

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [state])

  const currentIndex = useMemo(() => STEPS_ORDER.indexOf(state.currentStep), [state.currentStep])
  const isComplete = state.currentStep === "complete"
  const isLastStep = state.currentStep === "responseStyle"

  const canSkipStep = useCallback((step: WizardStep) => {
    return !["connection", "mode", "tone", "brands"].includes(step)
  }, [])

  const isStepComplete = useCallback(
    (step: WizardStep) => {
      switch (step) {
        case "connection":
          return Boolean(state.isTokenValid)
        case "mode":
          return Boolean(state.automationMode)
        case "ratings":
          return true
        case "tone":
          return Boolean(state.tone)
        case "brands":
          return state.signatures.length > 0
        case "responseStyle":
          return true
        case "complete":
          return true
        default:
          return false
      }
    },
    [state]
  )

  const markCompleted = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, completedSteps: uniqSteps([...prev.completedSteps, step]) }))
  }, [])

  const goToStep = useCallback((step: WizardStep) => {
    // Allow jumping only to already completed steps or steps before current
    const targetIndex = STEPS_ORDER.indexOf(step)
    const curIndex = STEPS_ORDER.indexOf(state.currentStep)
    if (targetIndex <= curIndex || state.completedSteps.includes(step)) {
      setState((prev) => ({ ...prev, currentStep: step }))
    }
  }, [state.currentStep, state.completedSteps])

  const prevStep = useCallback(() => {
    setError(null)
    setState((prev) => ({ ...prev, currentStep: prevStepOf(prev.currentStep) }))
  }, [])

  const skipStep = useCallback(() => {
    const step = state.currentStep
    if (!canSkipStep(step)) return
    markCompleted(step)
    setError(null)
    setState((prev) => ({ ...prev, currentStep: nextStepOf(prev.currentStep) }))
  }, [state.currentStep, canSkipStep, markCompleted])

  const exitWizard = useCallback(() => {
    router.push("/app/dashboard")
  }, [router])

  const verifyToken = useCallback(async (token: string) => {
    try {
      const res = await verifyWbToken(token)
      return { ok: Boolean((res as any)?.ok), shop_name: (res as any)?.shop_name || null, error: null as any }
    } catch (e: any) {
      return { ok: false, shop_name: null, error: e?.message || "Не удалось проверить токен" }
    }
  }, [])

  const saveSettingsToBackend = useCallback(async () => {
    if (!state.shopId) throw new Error("shop_id not set")

    const tone = state.tone
    const mode = state.automationMode

    // Per-rating workflow map (1..5): manual | semi | auto
    const rating_mode_map: Record<string, "manual" | "semi" | "auto"> = {}
    for (let s = 1; s <= 5; s++) {
      const v = (state.ratingModes as any)[s]
      rating_mode_map[String(s)] = v === "auto" || v === "semi" || v === "manual" ? v : "manual"
    }

    const allManual = Object.values(rating_mode_map).every((v) => v === "manual")
    const hasAuto = Object.values(rating_mode_map).some((v) => v === "auto")
    const reply_mode: "manual" | "semi" | "auto" = mode === "autopilot" ? "auto" : mode === "control" ? "semi" : "manual"

    const signaturesPayload = (state.signatures || []).map((s) => ({
      text: String(s.text || "").trim(),
      type: (s.type || "all") as any,
      brand: String(s.brand || "all"),
      is_active: typeof (s as any).is_active === "boolean" ? (s as any).is_active : true,
    }))

    const payload: any = {
      // Autopilot mode enables automation and auto-publish
      automation_enabled: mode === "autopilot",

      // Sync can be enabled regardless of automation.
      auto_sync: true,

      // Auto-draft for control and autopilot modes
      auto_draft: mode !== "manual",
      auto_publish: mode === "autopilot",

      reply_mode,
      rating_mode_map,
      min_rating_to_autopublish: mode === "autopilot" ? 1 : 4,

      questions_reply_mode: reply_mode,
      questions_auto_draft: mode !== "manual",
      questions_auto_publish: mode === "autopilot",

      tone,
      signature: null,
      signatures: signaturesPayload,

      config: {
        onboarding: {
          done: true,
          dashboard_intro_seen: false,
          automation_mode: mode,
        },
        advanced: {
          address_format: mapAddressFormat(state.responseStyle.addressForm),
          use_buyer_name: Boolean(state.responseStyle.useCustomerName),
          emoji_enabled: Boolean(state.responseStyle.useEmoji),
          answer_length: state.responseStyle.responseLength,
          // Apply chosen tone as baseline
          tone_of_voice: {
            positive: tone,
            neutral: tone,
            negative: tone,
            question: tone,
          },
        },
        // Removed from onboarding: keep recommendations OFF by default.
        recommendations: {
          enabled: false,
        },
        setup_wizard: {
          signatures: signaturesPayload,
          automation_mode: mode,
        },
      },
    }
    await updateSettings(state.shopId, payload)
  }, [state])

  const nextStep = useCallback(async () => {
    const step = state.currentStep
    setError(null)

    if (step === "connection") {
      // If shop already exists (re-running onboarding), just proceed
      if (state.shopId && state.storeConnected) {
        markCompleted("connection")
        setState((prev) => ({ ...prev, currentStep: nextStepOf(prev.currentStep) }))
        return
      }

      if (!state.isTokenValid || !state.token.trim()) return

      setBusy(true)
      try {
        if (!state.shopId) {
          const shop = await createShop({ wb_token: state.token.trim(), name: null })
          setSelectedShopId(shop.id)

          setState((prev) => ({
            ...prev,
            shopId: shop.id,
            storeConnected: true,
            storeName: shop.name,
          }))
        }

        markCompleted("connection")
        setState((prev) => ({ ...prev, currentStep: nextStepOf(prev.currentStep) }))
      } catch (e: any) {
        setError(e?.message || "Не удалось создать магазин")
      } finally {
        setBusy(false)
      }
      return
    }

    if (step === "responseStyle") {
      setBusy(true)
      try {
        await saveSettingsToBackend()
        markCompleted("responseStyle")
        setState((prev) => ({ ...prev, currentStep: "complete" }))
      } catch (e: any) {
        setError(e?.message || "Не удалось сохранить настройки")
      } finally {
        setBusy(false)
      }
      return
    }

    // Default: just proceed
    markCompleted(step)
    setState((prev) => ({ ...prev, currentStep: nextStepOf(prev.currentStep) }))
  }, [markCompleted, saveSettingsToBackend, state])

  const finishAndGo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    router.replace("/app/dashboard")
    router.refresh()
  }, [router])

  const goToSettings = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    router.push("/app/settings")
  }, [router])

  const renderStep = () => {
    switch (state.currentStep) {
      case "connection":
        return (
          <ConnectionStep
            isConnected={state.storeConnected}
            storeName={state.storeName}
            token={state.token}
            isTokenValid={state.isTokenValid}
            onVerifyToken={verifyToken}
            onUpdate={(data) => {
              setState((prev) => ({ ...prev, ...data }))
            }}
          />
        )

      case "mode":
        return (
          <ModeStep
            selectedMode={state.automationMode}
            onSelectMode={(mode) => {
              // Set rating modes based on selected automation mode
              let newRatingModes: RatingModes
              if (mode === "autopilot") {
                // All auto-publish
                newRatingModes = { 1: "auto", 2: "auto", 3: "auto", 4: "auto", 5: "auto" }
              } else if (mode === "control") {
                // All draft mode (semi)
                newRatingModes = { 1: "semi", 2: "semi", 3: "semi", 4: "semi", 5: "semi" }
              } else {
                // Manual - no automation
                newRatingModes = { 1: "manual", 2: "manual", 3: "manual", 4: "manual", 5: "manual" }
              }
              setState((p) => ({ ...p, automationMode: mode, ratingModes: newRatingModes }))
            }}
          />
        )


      case "ratings":
        return (
          <RatingsStep
            ratingModes={state.ratingModes}
            onUpdateRatings={(ratings) => setState((p) => ({ ...p, ratingModes: ratings }))}
          />
        )

      case "tone":
        return (
          <ToneStep
            selectedTone={state.tone}
            onSelectTone={(tone) => setState((p) => ({ ...p, tone }))}
            tones={toneOptions}
            loading={toneLoading}
          />
        )

      case "brands":
        return (
          <BrandsStep
            shopId={state.shopId}
            items={state.signatures}
            onUpdate={(items) => setState((p) => ({ ...p, signatures: items }))}
          />
        )

      case "responseStyle":
        return (
          <ResponseStyleStep
            config={state.responseStyle}
            onUpdate={(cfg) => setState((p) => ({ ...p, responseStyle: { ...p.responseStyle, ...cfg } }))}
          />
        )

      case "complete":
        return <CompleteStep shopId={state.shopId ?? undefined} onFinish={finishAndGo} onSetupQuestions={goToSettings} onSetupChats={goToSettings} />

      default:
        return null
    }
  }

  const canProceed = isStepComplete(state.currentStep) && !busy

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isComplete && (
        <header className="border-b bg-card px-6 py-4">
          <WizardProgress currentStep={state.currentStep} completedSteps={state.completedSteps} onStepClick={goToStep} />
        </header>
      )}

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-8 pb-6">
            {renderStep()}

            {error ? <div className="mt-6 text-sm text-destructive">{error}</div> : null}

            {!isComplete && (
              <WizardNavigation
                currentStep={state.currentStep}
                canSkip={canSkipStep(state.currentStep) && !busy}
                canGoBack={currentIndex > 0 && !busy}
                canProceed={canProceed}
                isLastStep={isLastStep}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={skipStep}
                onExit={exitWizard}
              />
            )}

            {busy ? <div className="mt-4 text-xs text-muted-foreground">Подождите…</div> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
