"use client"

/**
 * Auth token helpers.
 *
 * We store the JWT in a cookie (not localStorage) so it is attached to all
 * HTTP requests by default and can be read by Next server components for
 * route guards.
 */

import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie"

function buildCookieValue(token: string) {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`
}

export function setAuthToken(token: string) {
  // NOTE: HttpOnly cannot be set from browser JS. If you need HttpOnly,
  // implement a Next route handler (server) that sets the cookie.
  const parts = [
    buildCookieValue(token),
    "Path=/",
    "SameSite=Lax",
    // If you serve over HTTPS, you can also add Secure.
    // "Secure",
  ]
  document.cookie = parts.join("; ")
}

export function clearAuthToken() {
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function getAuthToken(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie ? document.cookie.split(";") : []
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split("=")
    if (rawName === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rest.join("=") || "") || null
    }
  }
  return null
}
