import { cookies } from "next/headers"

import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie"

export type Me = { id: number; email: string; role: string }

export function getBackendOrigin() {
  return ("https://aveotvet.ozodbek-akramov.uz")
}

export async function getTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(AUTH_COOKIE_NAME)?.value || null
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
