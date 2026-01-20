"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

import { register } from "@/lib/api"

interface RegisterFormProps {
  onSuccess?: () => void
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      await register(email, password)
      onSuccess?.()
      router.push("/login")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed"
      console.log("[register] error:", message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen wb-bg-soft flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl border border-border bg-card/80 shadow-xl backdrop-blur">
        <div className="p-8">
          <div className="mb-2">
            <h1 className="text-3xl font-bold wb-gradient-text">AVEOTVET</h1>
          </div>
          <p className="text-muted-foreground mb-8 text-sm">Create your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 rounded-xl"
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
                className="mt-2 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2 rounded-xl"
                required
              />
            </div>

            {error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : null}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:opacity-80 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
