"use client"

import LoginForm from "@/components/auth/login-form"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  return (
    <LoginForm
      onSuccess={() => {
        router.push("/")
        router.refresh()
      }}
    />
  )
}
