"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

import { login } from "@/lib/api"
import { setAuthToken } from "@/lib/auth"

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
      // Let the root route decide where to send the user (admin vs store).
      router.push("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      console.log("[login] error:", message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen wb-bg-soft flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl shadow-black/5">
        <div className="p-8">
          <div className="mb-2">
            <h1 className="text-3xl font-bold wb-gradient-text">WB Manager</h1>
          </div>
          <p className="text-muted-foreground mb-8 text-sm">
            Вход в систему управления отзывами и чатами
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground rounded-xl"
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
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                required
              />
            </div>

            {error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : null}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary hover:opacity-80 font-medium">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
