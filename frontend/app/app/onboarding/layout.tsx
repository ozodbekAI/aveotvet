import type React from "react"
import { requireAuth } from "@/lib/server-backend"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  return <>{children}</>
}
