import { redirect } from "next/navigation"

import { getMeServer, getTokenFromCookie, isAdminRole } from "@/lib/server-backend"

export default async function Home() {
  const token = await getTokenFromCookie()
  if (!token) {
    redirect("/login")
  }

  const me = await getMeServer(token)
  if (!me) {
    redirect("/login")
  }

  if (isAdminRole(me.role)) {
    redirect("/admin/dashboard")
  }

  redirect("/app/dashboard")
}
