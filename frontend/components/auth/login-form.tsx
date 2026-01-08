"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { login } from "@/lib/api"
import { setAuthToken } from "@/lib/auth"
import { useRouter } from "next/navigation"

interface LoginFormProps {
  onSuccess?: () => void
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      setError("Please enter email and password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await login(email, password)
      const token = (response as any).access_token || (response as any).token || response
      if (!token) {
        throw new Error("No token received from server")
      }
      setAuthToken(String(token))
      onSuccess?.()
      router.push("/feedbacks")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      console.log("[v0] Login Error:", message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">WB Otveto</h1>
          <p className="text-muted-foreground mb-8">Manage Wildberries feedback and responses</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-xs text-blue-700">
              <strong>⚠️ Important:</strong> Make sure your backend is running at{" "}
              <code className="bg-white px-1 py-0.5 rounded text-blue-900">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </code>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
