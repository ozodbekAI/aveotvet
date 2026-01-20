import { redirect } from "next/navigation"

import AdminShell from "@/components/admin-shell"
import { getMeServer, getTokenFromCookie, isAdminRole } from "@/lib/server-backend"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = await getTokenFromCookie()
  if (!token) {
    redirect("/login")
  }

  const me = await getMeServer(token)
  if (!me) {
    redirect("/login")
  }

  if (!isAdminRole(me.role)) {
    redirect("/app/dashboard")
  }

  return <AdminShell>{children}</AdminShell>
}
