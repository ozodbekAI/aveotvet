import { getAuthToken } from "@/lib/auth"

/**
 * Backend base URL.
 *
 * Recommended setup (dev):
 *  - Leave NEXT_PUBLIC_API_URL empty
 *  - Run backend on http://127.0.0.1:8000
 *  - next.config.mjs rewrites /api/* -> backend
 *
 * Production setup:
 *  - Set NEXT_PUBLIC_API_URL to your backend origin (e.g. https://api.example.com)
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? getAuthToken() : null

  const headers: Record<string, string> = {}
  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value
    })
  } else if (options.headers) {
    Object.assign(headers, options.headers)
  }

  // Only set JSON content type when body is not FormData.
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type")
  if (!hasContentType && options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  if (token) headers["Authorization"] = `Bearer ${token}`

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const contentType = response.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`

      try {
        if (isJson) {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorMessage
        } else {
          const text = await response.text()
          if (text.includes("<!DOCTYPE") || text.includes("<html")) {
            errorMessage = `Server error - check if backend is running at ${API_BASE}`
          }
        }
      } catch {
        // Ignore parsing errors
      }

      throw new Error(errorMessage)
    }

    if (!isJson) {
      throw new Error(`Expected JSON response, got ${contentType || "unknown content type"}`)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof Error) {
      console.log("[v0] API Error:", error.message)
      throw error
    }
    throw new Error("Network error - unable to reach server")
  }
}

// Auth
export async function login(email: string, password: string) {
  return apiCall("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export async function register(email: string, password: string) {
  return apiCall("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

// Prompts (global)
export async function getToneOptions() {
  return apiCall<Array<{ value: string; label: string; hint?: string }>>("/api/prompts/tone-options")
}

export async function getMe() {
  return apiCall<{ id: number; email: string; role: string }>("/api/auth/me")
}

// Admin (super_admin)
export async function adminListUsers() {
  return apiCall<Array<{ id: number; email: string; role: string; is_active: boolean }>>("/api/admin/users")
}

export async function adminSetUserRole(userId: number, role: string) {
  return apiCall(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  })
}

export async function adminGetPrompts() {
  return apiCall<any>("/api/admin/prompts")
}

export async function adminUpdatePrompts(payload: any) {
  return apiCall<any>("/api/admin/prompts", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function adminListTones() {
  return apiCall<Array<{ id: number; code: string; label: string; hint?: string | null; instruction?: string | null; sort_order: number; is_active: boolean }>>(
    "/api/admin/tones"
  )
}

export async function adminCreateTone(payload: any) {
  return apiCall("/api/admin/tones", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function adminUpdateTone(toneId: number, payload: any) {
  return apiCall(`/api/admin/tones/${toneId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function adminDeleteTone(toneId: number) {
  return apiCall(`/api/admin/tones/${toneId}`, {
    method: "DELETE",
  })
}

// Shops
export async function listShops() {
  return apiCall("/api/shops")
}

export async function getShop(shopId: number) {
  return apiCall(`/api/shops/${shopId}`)
}

// Canonical brands (WB analytics API proxied by backend)
export async function getShopBrands(shopId: number) {
  return apiCall<{ data: string[]; cached?: boolean }>(`/api/shops/${shopId}/brands`)
}

// createShop accepts either (name, wbToken) or an object {name, wb_token}
export async function createShop(nameOrPayload: string | { name: string; wb_token: string }, wbToken?: string) {
  const payload =
    typeof nameOrPayload === "string"
      ? { name: nameOrPayload, wb_token: wbToken || "" }
      : { name: nameOrPayload.name, wb_token: nameOrPayload.wb_token }

  return apiCall("/api/shops", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// Settings
export async function getSettings(shopId: number) {
  return apiCall(`/api/settings/${shopId}`)
}

export async function updateSettings(shopId: number, data: any) {
  return apiCall(`/api/settings/${shopId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

// Feedbacks
export async function listFeedbacks(shopId: number, filters?: any) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  return apiCall(`/api/feedbacks/${shopId}?${params}`)
}

export async function getFeedback(shopId: number, wbId: string) {
  return apiCall(`/api/feedbacks/${shopId}/${wbId}`)
}

export async function syncFeedbacks(shopId: number) {
  return apiCall(`/api/feedbacks/${shopId}/sync`, {
    method: "POST",
    // Backend expects SyncRequest body; keep defaults.
    body: JSON.stringify({}),
  })
}

// Dashboard
export type DashboardTabKey = "feedbacks" | "questions" | "chats"

export type DashboardMeta = {
  shop_ids: number[]
  range_days: number
  date_from_iso: string
  date_to_iso: string
}

export type DashboardKpis = {
  total: number
  pending: number
  unanswered: number
  answered: number
  avg_rating?: number | null
  positive_share?: number | null
}

export type DashboardLinePoint = { d: string; v: number }

export type DashboardLine = {
  data: DashboardLinePoint[]
  period_text: string
}

export type DashboardTopItem = {
  title: string
  brand?: string | null
  count: number
}

export type DashboardTopBlock = {
  primary: DashboardTopItem[]
  secondary: DashboardTopItem[]
}

export type DashboardOut = {
  meta: DashboardMeta
  kpis: DashboardKpis
  line: DashboardLine
  top: DashboardTopBlock
}

export type DashboardSyncOut = {
  queued: boolean
  job_id?: number
  job_ids?: number[]
}

export async function getDashboard(tab: DashboardTabKey, params?: { shop_id?: number | null; period?: string }) {
  const qs = new URLSearchParams()
  if (params?.shop_id) qs.set("shop_id", String(params.shop_id))
  if (params?.period) qs.set("period", String(params.period))
  const q = qs.toString()
  return apiCall<DashboardOut>(`/api/dashboard/${tab}${q ? `?${q}` : ""}`)
}

export async function syncDashboard(tab: DashboardTabKey, params?: { shop_id?: number | null; period?: string }) {
  const qs = new URLSearchParams()
  if (params?.shop_id) qs.set("shop_id", String(params.shop_id))
  if (params?.period) qs.set("period", String(params.period))
  const q = qs.toString()
  return apiCall<DashboardSyncOut>(`/api/dashboard/${tab}/sync${q ? `?${q}` : ""}`, { method: "POST" })
}
export async function generateFeedbackDraft(shopId: number, wbId: string) {
  return apiCall(`/api/feedbacks/${shopId}/${wbId}/draft`, {
    method: "POST",
  })
}

export async function editFeedbackAnswer(shopId: number, wbId: string, text: string) {
  return apiCall(`/api/feedbacks/${shopId}/${wbId}/answer/edit`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function publishFeedbackAnswer(shopId: number, wbId: string, text?: string) {
  return apiCall(`/api/feedbacks/${shopId}/${wbId}/publish`, {
    method: "POST",
    body: text ? JSON.stringify({ text }) : undefined,
  })
}

// Questions
export async function listQuestions(shopId: number, filters?: any) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  return apiCall(`/api/questions/${shopId}?${params}`)
}

export async function getQuestion(shopId: number, wbId: string) {
  return apiCall(`/api/questions/${shopId}/${wbId}`)
}

export async function syncQuestions(shopId: number, filters?: any) {
  return apiCall(`/api/questions/${shopId}/sync`, {
    method: "POST",
    body: JSON.stringify(filters || {}),
  })
}

export async function generateQuestionDraft(shopId: number, wbId: string) {
  return apiCall(`/api/questions/${shopId}/${wbId}/draft`, {
    method: "POST",
  })
}

export async function publishQuestionAnswer(shopId: number, wbId: string, text?: string) {
  return apiCall(`/api/questions/${shopId}/${wbId}/publish`, {
    method: "POST",
    body: text ? JSON.stringify({ text }) : undefined,
  })
}

export async function rejectQuestion(shopId: number, wbId: string) {
  return apiCall(`/api/questions/${shopId}/${wbId}/reject`, {
    method: "POST",
  })
}

// Drafts (auto-generated answers for reviews)
export async function listDrafts(
  shopId: number,
  params?: { status?: "drafted" | "published" | "rejected"; limit?: number; offset?: number },
) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.limit !== undefined) qs.set("limit", String(params.limit))
  if (params?.offset !== undefined) qs.set("offset", String(params.offset))
  const q = qs.toString()
  return apiCall(`/api/drafts/${shopId}/drafts${q ? `?${q}` : ""}`)
}

export async function listPendingDrafts(shopId: number, params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set("limit", String(params.limit))
  if (params?.offset !== undefined) qs.set("offset", String(params.offset))
  const q = qs.toString()
  return apiCall(`/api/drafts/${shopId}/drafts/pending${q ? `?${q}` : ""}`)
}

export async function getDraft(shopId: number, draftId: number) {
  return apiCall(`/api/drafts/${shopId}/drafts/${draftId}`)
}

export async function updateDraft(shopId: number, draftId: number, payload: { text?: string; status?: string }) {
  return apiCall(`/api/drafts/${shopId}/drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function approveDraft(shopId: number, draftId: number) {
  return apiCall(`/api/drafts/${shopId}/drafts/${draftId}/approve`, { method: "POST" })
}

export async function rejectDraft(shopId: number, draftId: number) {
  return apiCall(`/api/drafts/${shopId}/drafts/${draftId}/reject`, { method: "POST" })
}

export async function regenerateDraft(shopId: number, draftId: number) {
  return apiCall(`/api/drafts/${shopId}/drafts/${draftId}/regenerate`, { method: "POST" })
}

export async function getDraftStats(shopId: number) {
  return apiCall(`/api/drafts/${shopId}/drafts/stats`)
}

// Chats
export async function listChats(shopId: number, filters?: any) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  return apiCall(`/api/chats/${shopId}?${params}`)
}

export async function getChatEvents(shopId: number, chatId: string, filters?: any) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  return apiCall(`/api/chats/${shopId}/${chatId}/events?${params}`)
}

export async function syncChats(shopId: number) {
  return apiCall(`/api/chats/${shopId}/sync`, { method: "POST" })
}

export async function generateChatDraft(shopId: number, chatId: string) {
  return apiCall(`/api/chats/${shopId}/${chatId}/draft`, {
    method: "POST",
  })
}

export async function sendChatMessage(
  shopId: number,
  chatId: string,
  options: { message?: string; useLatestDraft?: boolean; files?: File[] } = {},
) {
  const formData = new FormData()
  if (options.message !== undefined) formData.append("message", options.message)
  formData.append("use_latest_draft", String(options.useLatestDraft ?? true))
  if (options.files?.length) {
    options.files.forEach((file) => formData.append("files", file))
  }

  const token = typeof window !== "undefined" ? getAuthToken() : null
  const response = await fetch(`${API_BASE}/api/chats/${shopId}/${chatId}/send`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  })

  if (!response.ok) throw new Error("Failed to send message")

  const ct = response.headers.get("content-type") || ""
  if (ct.includes("application/json")) return response.json()
  return {} as any
}

export async function downloadChatFile(shopId: number, downloadId: string): Promise<Blob> {
  const token = typeof window !== "undefined" ? getAuthToken() : null
  const res = await fetch(`${API_BASE}/api/chats/${shopId}/download/${downloadId}`, {
    method: "GET",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })
  if (!res.ok) throw new Error("Failed to download file")
  return res.blob()
}

// Buyers
export async function listBuyers(shopId: number, params?: { q?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set("q", params.q)
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.offset) qs.set("offset", String(params.offset))
  return apiCall(`/api/buyers/${shopId}?${qs.toString()}`)
}

export async function getBuyerThread(shopId: number, userName: string, params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.offset) qs.set("offset", String(params.offset))
  return apiCall(`/api/buyers/${shopId}/${encodeURIComponent(userName)}/thread?${qs.toString()}`)
}

// Pins
export async function listPins(
  shopId: number,
  params?: {
    state?: "pinned" | "unpinned"
    pin_on?: "nm" | "imt"
    nm_id?: number
    feedback_id?: number
    date_from?: string
    date_to?: string
    next?: number
    limit?: number
  },
) {
  const qs = new URLSearchParams()
  if (!params) return apiCall(`/api/feedbacks/${shopId}/pins`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  })
  return apiCall(`/api/feedbacks/${shopId}/pins?${qs.toString()}`)
}

export async function pinsLimits(shopId: number) {
  return apiCall(`/api/feedbacks/${shopId}/pins/limits`)
}

export async function pinFeedback(shopId: number, feedbackId: string, pinOn: "imt" | "nm" = "imt") {
  const qs = new URLSearchParams({ feedback_id: feedbackId, pin_on: pinOn })
  return apiCall(`/api/feedbacks/${shopId}/pins/pin?${qs.toString()}`, { method: "POST" })
}

export async function unpinFeedback(shopId: number, pinId: number) {
  const qs = new URLSearchParams({ pin_id: String(pinId) })
  return apiCall(`/api/feedbacks/${shopId}/pins/unpin?${qs.toString()}`, { method: "DELETE" })
}

// Jobs
export async function getJobStatus(jobId: number) {
  return apiCall(`/api/jobs/${jobId}`)
}

export async function listJobs(params?: { shop_id?: number; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.shop_id) qs.set("shop_id", String(params.shop_id))
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.offset) qs.set("offset", String(params.offset))
  return apiCall(`/api/jobs?${qs.toString()}`)
}
