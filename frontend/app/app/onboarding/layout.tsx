import type React from "react"

import { redirect } from "next/navigation"

import { getMeServer, getTokenFromCookie } from "@/lib/server-backend"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const token = await getTokenFromCookie()
  if (!token) redirect("/login")

  const me = await getMeServer(token)
  if (!me) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}
