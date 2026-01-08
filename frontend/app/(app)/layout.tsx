import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie"
import AppShell from "@/components/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Next.js 15+ may return cookies() as a Promise; awaiting works across versions.
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) {
    redirect("/login")
  }

  return <AppShell>{children}</AppShell>
}
