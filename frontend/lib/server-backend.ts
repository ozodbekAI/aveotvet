import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie"

export type Me = { id: number; email: string; role: string }

export function getBackendOrigin() {
  return process.env.NEXT_PUBLIC_API_BASE || process.env.BACKEND_ORIGIN || "https://aveotvet.ozodbek-akramov.uz"
}

export type ShopOut = { id: number; name: string; my_role?: string | null }

export async function listShopsServer(token: string): Promise<ShopOut[] | null> {
  try {
    const res = await fetch(`${getBackendOrigin()}/api/shops`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as ShopOut[]
  } catch {
    return null
  }
}

export async function getTokenFromCookie(): Promise<string | null> {
  // next/headers cookies() is sync, keep this helper async for ergonomic usage
  const cookieStore = cookies()
  return (await cookieStore).get(AUTH_COOKIE_NAME)?.value || null
}

/**
 * Server-side auth guard for App Router layouts/pages.
 * Redirects to /login if token missing or invalid.
 */
export async function requireAuth(opts?: { redirectTo?: string }) {
  const to = opts?.redirectTo || "/login"
  const token = await getTokenFromCookie()
  if (!token) redirect(to)

  const me = await getMeServer(token)
  if (!me) redirect(to)

  return { token, me }
}

export async function getMeServer(token: string): Promise<Me | null> {
  try {
    const res = await fetch(`${getBackendOrigin()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as Me
  } catch {
    return null
  }
}

export function isAdminRole(role?: string | null) {
  return role === "super_admin" || role === "support_admin"
}
