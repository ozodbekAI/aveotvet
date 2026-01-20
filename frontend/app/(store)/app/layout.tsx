import { redirect } from "next/navigation"

import AppShell from "@/components/app-shell"
import { getMeServer, getTokenFromCookie, isAdminRole } from "@/lib/server-backend"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Next.js 15+ may return cookies() as a Promise; awaiting works across versions.
  const token = await getTokenFromCookie()
  if (!token) {
    redirect("/login")
  }

  const me = await getMeServer(token)
  if (me && isAdminRole(me.role)) {
    redirect("/admin/dashboard")
  }

  return <AppShell>{children}</AppShell>
}
