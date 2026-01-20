import { getAuthToken } from "@/lib/auth"

const API_BASE = "https://aveotvet.ozodbek-akramov.uz/api"

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

// Admin dashboards / ops / finance
export type SystemHealth = {
  active_shops: number
  shops_with_sync_errors: number
  generation_queue_size: number
  generation_errors_24h: number
  autopublish_enabled_shops: number
  autopublish_errors_24h: number
}

export type FinanceSummaryOut = {
  period: string
  date_from?: string | null
  date_to?: string | null
  money_received_rub: number
  gpt_cost_rub: number
  gross_result_rub: number
}

export type GptCostBreakdownRow = {
  operation_type: string
  gpt_cost_rub: number
  percent: number
}

export type FinanceTopShopRow = {
  shop_id: number
  shop?: string
  shop_name?: string
  gpt_cost_rub: number
  generations_count: number
}

export type FinanceIncidentRow = {
  shop_id: number
  shop?: string
  shop_name?: string
  incident_type: string
  since?: string | null
}

export type FinanceBreakdownOut = {
  summary: FinanceSummaryOut
  breakdown: GptCostBreakdownRow[]
  top_shops: FinanceTopShopRow[]
  incidents: FinanceIncidentRow[]
}


export async function adminSystemHealth() {
  return apiCall<SystemHealth>("/api/admin/dashboard/system-health")
}

export async function adminFinance(period: "today" | "last_7_days" | "last_30_days" | "all_time") {
  return apiCall<FinanceBreakdownOut>(`/api/admin/dashboard/finance?period=${period}`)
}

export type OpsStatus = {
  jobs_pending: number
  jobs_failed: number
  jobs_retrying: number
  avg_generation_time: number
  errors_24h?: Array<{ error_type: string; count_24h: number; last_seen: string }>
}

export async function adminOpsStatus() {
  return apiCall<OpsStatus>("/api/admin/ops/status")
}

export async function adminOpsSyncRun(shop_id: number) {
  return apiCall("/api/admin/ops/sync/run", { method: "POST", body: JSON.stringify({ shop_id }) })
}

export async function adminOpsRetryFailed(shop_id: number) {
  return apiCall("/api/admin/ops/jobs/retry-failed", { method: "POST", body: JSON.stringify({ shop_id }) })
}

export async function adminOpsKillSwitch(shop_id: number, enabled: boolean) {
  return apiCall("/api/admin/ops/kill-switch", { method: "POST", body: JSON.stringify({ shop_id, enabled }) })
}

// Payments
export type Payment = { id: number; shop_id: number; amount_rub: number; created_at: string }

export async function adminListPayments(params?: { shop_id?: number }) {
  const q = new URLSearchParams()
  if (params?.shop_id) q.set("shop_id", String(params.shop_id))
  const suffix = q.toString() ? `?${q.toString()}` : ""
  return apiCall<Payment[]>(`/api/admin/payments${suffix}`)
}

export async function adminCreatePayment(payload: { shop_id: number; amount_rub: number; comment?: string }) {
  return apiCall<Payment>("/api/admin/payments", { method: "POST", body: JSON.stringify(payload) })
}

// Logs / Audit
export async function adminListLogs(params?: { shop_id?: number }) {
  const q = new URLSearchParams()
  if (params?.shop_id) q.set("shop_id", String(params.shop_id))
  const suffix = q.toString() ? `?${q.toString()}` : ""
  return apiCall<any[]>(`/api/admin/logs${suffix}`)
}

export async function adminExportLogs(params?: { shop_id?: number }) {
  const q = new URLSearchParams()
  if (params?.shop_id) q.set("shop_id", String(params.shop_id))
  const suffix = q.toString() ? `?${q.toString()}` : ""
  return apiCall<{ url: string }>(`/api/admin/logs/export${suffix}`)
}

export async function adminAuditList(params?: { shop_id?: number }) {
  const q = new URLSearchParams()
  if (params?.shop_id) q.set("shop_id", String(params.shop_id))
  const suffix = q.toString() ? `?${q.toString()}` : ""
  return apiCall<any[]>(`/api/admin/audit${suffix}`)
}

// AI settings
export async function adminAiGetAll() {
  return apiCall<any>("/api/admin/ai")
}

export async function adminAiUpdateAll(payload: any) {
  return apiCall<any>("/api/admin/ai", { method: "PUT", body: JSON.stringify(payload) })
}

// Shops
// v1: store roles are owner/manager only (viewer/operator removed).
export type ShopRole = "manager" | "owner"

export type ShopOut = {
  id: number
  name: string
  my_role?: ShopRole
}

export async function listShops() {
  return apiCall<ShopOut[]>("/api/shops")
}

export async function getShop(shopId: number) {
  return apiCall<ShopOut>(`/api/shops/${shopId}`)
}

// Canonical brands (WB analytics API proxied by backend)
export async function getShopBrands(shopId: number) {
  return apiCall<{ data: string[]; cached?: boolean }>(`/api/shops/${shopId}/brands`)
}

// createShop: self-serve shop creation.
// WB token is optional and can be configured later from Settings (owner-only).
export async function createShop(payload: { name: string; wb_token?: string | null } | string) {
  const body = typeof payload === "string" ? { name: payload } : payload
  return apiCall<ShopOut>("/api/shops", {
    method: "POST",
    body: JSON.stringify(body),
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

export async function syncFeedbacks(shopId: number, payload?: any) {
  return apiCall(`/api/feedbacks/${shopId}/sync`, {
    method: "POST",
    // Backend expects SyncRequest body.
    body: JSON.stringify(payload || {}),
  })
}

export async function bulkDraftFeedbacks(shopId: number, payload: { limit: number }) {
  return apiCall(`/api/feedbacks/${shopId}/bulk/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// Dashboard
export type DashboardTabKey = "feedbacks" | "questions" | "chats"

export type DashboardMeta = {
  shop_ids: number[]
  range_days: number
  date_from: string
  date_to: string
}

export type DashboardKpis = {
  total: number
  pending: number
  unanswered: number
  answered: number
  avgRating: number
  positiveShare: number
}

export type DashboardLinePoint = { d: string; v: number }

export type DashboardLine = {
  data: DashboardLinePoint[]
  periodText: string
  previousData?: DashboardLinePoint[]
  previousPeriodText?: string | null
}

export type DashboardTopItem = {
  title: string
  brand?: string | null
  count: number
}

export type DashboardTopBlock = {
  positive: DashboardTopItem[]
  negative: DashboardTopItem[]
}

export type DashboardOut = {
  meta: DashboardMeta
  kpis: DashboardKpis
  line: DashboardLine
  top: DashboardTopBlock
}

export type DashboardSyncOut = {
  queued: number
  skipped: number
  job_ids: number[]
}

export async function getDashboard(tab: DashboardTabKey, params?: { shop_id?: number | null; period?: string }) {
  const qs = new URLSearchParams()
  if (params?.shop_id !== undefined && params?.shop_id !== null) qs.set("shop_id", String(params.shop_id))
  if (params?.period) qs.set("period", String(params.period))
  const q = qs.toString()
  return apiCall<DashboardOut>(`/api/dashboard/${tab}${q ? `?${q}` : ""}`)
}

export async function syncDashboard(tab: DashboardTabKey, params?: { shop_id?: number | null; period?: string }) {
  const qs = new URLSearchParams()
  if (params?.shop_id !== undefined && params?.shop_id !== null) qs.set("shop_id", String(params.shop_id))
  if (params?.period) qs.set("period", String(params.period))
  const q = qs.toString()
  return apiCall<DashboardSyncOut>(`/api/dashboard/${tab}/sync${q ? `?${q}` : ""}`, { method: "POST" })
}
export type DraftCreateResponse = {
  draft_id: number
  status: string
  text: string
}

export async function generateFeedbackDraft(shopId: number, wbId: string) {
  return apiCall<DraftCreateResponse>(`/api/feedbacks/${shopId}/${wbId}/draft`, {
    method: "POST",
  })
}

export async function getLatestFeedbackDraft(shopId: number, wbId: string) {
  return apiCall<DraftCreateResponse>(`/api/feedbacks/${shopId}/${wbId}/draft/latest`)
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

export type ChatSessionRow = {
  shop_id: number
  shop_name: string
  chat_id: string
  client_id?: string | null
  client_name?: string | null
  good_card?: any | null
  last_message?: any | null
  nm_id?: number | null
  product_title?: string | null
  product_brand?: string | null
  product_thumb_url?: string | null
  unread_count: number
  updated_at: string
}

export type ChatSessionsPage = {
  total: number
  items: ChatSessionRow[]
}

export async function listChatsPage(params: {
  shopId?: number | null
  limit?: number
  offset?: number
  dateFromUnix?: number | null
  dateToUnix?: number | null
  unread?: boolean | null
}): Promise<ChatSessionsPage> {
  const qs = new URLSearchParams()
  if (params.shopId !== undefined && params.shopId !== null) qs.set("shop_id", String(params.shopId))
  if (params.limit) qs.set("limit", String(params.limit))
  if (params.offset) qs.set("offset", String(params.offset))
  if (params.dateFromUnix !== undefined && params.dateFromUnix !== null) qs.set("date_from_unix", String(params.dateFromUnix))
  if (params.dateToUnix !== undefined && params.dateToUnix !== null) qs.set("date_to_unix", String(params.dateToUnix))
  if (params.unread !== undefined && params.unread !== null) qs.set("unread", String(params.unread))
  return apiCall(`/api/chats/page?${qs.toString()}`)
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

// Billing (shop-scoped)
export type LedgerItem = {
  id?: number
  created_at?: string
  delta: number
  reason: string
  meta?: any
  actor_user_id?: number | null
}

export type ShopBilling = {
  shop_id: number
  credits_balance: number
  credits_spent: number
  recent: LedgerItem[]
}

export async function getBillingShops() {
  return apiCall<{ shops: ShopBilling[] }>(`/api/billing/shops`)
}

export async function getBillingShop(shopId: number) {
  return apiCall<ShopBilling>(`/api/billing/shops/${shopId}`)
}

// Shop members
export type ShopMember = { user_id: number; email?: string | null; role: string }

export async function listShopMembers(shopId: number) {
  return apiCall<ShopMember[]>(`/api/shops/${shopId}/members`)
}

export async function addShopMember(shopId: number, payload: { email: string; role: string; password?: string }) {
  return apiCall(`/api/shops/${shopId}/members`, { method: "POST", body: JSON.stringify(payload) })
}

export async function updateShopMember(shopId: number, userId: number, payload: { role: string }) {
  return apiCall(`/api/shops/${shopId}/members/${userId}`, { method: "PUT", body: JSON.stringify(payload) })
}

export async function deleteShopMember(shopId: number, userId: number) {
  return apiCall(`/api/shops/${shopId}/members/${userId}`, { method: "DELETE" })
}

// Admin (super_admin) - extended
export type AdminUser = {
  id: number
  email: string
  role: string
  is_active: boolean
  credits_balance?: number
  credits_spent?: number
}

export async function adminCreateUser(payload: { email: string; password: string; role?: string; is_active?: boolean }) {
  return apiCall(`/api/admin/users`, { method: "POST", body: JSON.stringify(payload) })
}

export async function adminSetUserActive(userId: number, is_active: boolean) {
  return apiCall(`/api/admin/users/${userId}/active`, { method: "PUT", body: JSON.stringify({ is_active }) })
}

export async function adminUserShops(userId: number) {
  return apiCall(`/api/admin/users/${userId}/shops`)
}

export type AdminShop = {
  id: number
  name: string
  owner_user_id: number
  owner_email?: string | null
  is_active: boolean
  created_at?: string
  credits_balance: number
  credits_spent: number
}

export async function adminListShops() {
  return apiCall<AdminShop[]>(`/api/admin/shops`)
}

export async function adminCreateShop(payload: { owner_user_id: number; name: string; wb_token: string }) {
  return apiCall(`/api/admin/shops`, { method: "POST", body: JSON.stringify(payload) })
}

export async function adminUpdateShop(shopId: number, payload: any) {
  return apiCall(`/api/admin/shops/${shopId}`, { method: "PUT", body: JSON.stringify(payload) })
}

export async function adminAdjustShopCredits(shopId: number, payload: { delta: number; reason?: string; meta?: any }) {
  return apiCall(`/api/admin/shops/${shopId}/credits`, { method: "POST", body: JSON.stringify(payload) })
}

export async function adminAdjustUserCredits(userId: number, payload: { delta: number; reason?: string; meta?: any }) {
  return apiCall(`/api/admin/users/${userId}/credits`, { method: "POST", body: JSON.stringify(payload) })
}
