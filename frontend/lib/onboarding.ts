"use client"

export type OnboardingDraft = {
  v: 1
  shop_id: number | null
  shop_name: string

  // Step 1
  automation_enabled: boolean
  auto_sync: boolean
  auto_draft: boolean
  auto_publish: boolean

  // Step 2
  min_rating_to_autopublish: number
  reply_mode: "manual" | "semi" | "auto"

  // Step 3
  tone: string
  // Legacy single signature (kept for backward compatibility)
  signature: string
  // Brand-specific signatures: brand name -> signature text
  signatures_by_brand: Record<string, string>
}

const KEY = "wb_otveto_onboarding_draft"

export function defaultDraft(): OnboardingDraft {
  return {
    v: 1,
    shop_id: null,
    shop_name: "",
    automation_enabled: true,
    auto_sync: true,
    auto_draft: true,
    auto_publish: false,
    min_rating_to_autopublish: 5,
    reply_mode: "semi",
    tone: "friendly",
    signature: "",
    signatures_by_brand: {},
  }
}

export function loadDraft(): OnboardingDraft {
  if (typeof window === "undefined") return defaultDraft()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultDraft()
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== 1) return defaultDraft()
    const merged: any = { ...defaultDraft(), ...parsed }
    // migrate legacy signature -> brand signatures
    if (
      (!merged.signatures_by_brand || Object.keys(merged.signatures_by_brand).length === 0) &&
      typeof merged.signature === "string" &&
      merged.signature.trim()
    ) {
      merged.signatures_by_brand = { all: merged.signature }
    }
    return merged
  } catch {
    return defaultDraft()
  }
}

export function saveDraft(patch: Partial<OnboardingDraft>): OnboardingDraft {
  const next = { ...loadDraft(), ...patch, v: 1 as const }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  }
  return next
}

export function clearDraft() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY)
}

export const SELECTED_SHOP_KEY = "wb_otveto_selected_shop_id"

export function setSelectedShopId(shopId: number) {
  if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_SHOP_KEY, String(shopId))
}
