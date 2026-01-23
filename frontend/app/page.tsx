import { redirect } from "next/navigation"

import Landing from "@/components/marketing/landing"
import { getMeServer, getTokenFromCookie, isAdminRole } from "@/lib/server-backend"

export default async function Home() {
  // If the user is already logged-in, keep the old behavior (send them to the right dashboard).
  const token = await getTokenFromCookie()
  if (token) {
    const me = await getMeServer(token)
    if (me) {
      if (isAdminRole(me.role)) {
        redirect("/admin/dashboard")
      }
      redirect("/app/dashboard")
    }
  }

  // Otherwise show the public landing page.
  return <Landing />
}
