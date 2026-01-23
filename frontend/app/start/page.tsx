"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { register, login } from "@/lib/api"
import { setAuthToken } from "@/lib/auth"

function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim())
}

export default function StartPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = useMemo(() => {
    if (!email || !password || !confirmPassword) return false
    if (!isEmail(email)) return false
    if (password.length < 8) return false
    if (password !== confirmPassword) return false
    return true
  }, [email, password, confirmPassword])

  const handleStart = async () => {
    setIsLoading(true)
    setError("")
    try {
      // Register returns a token in our backend.
      const resp = await register(email.trim(), password)
      const token = (resp as any)?.access_token || (resp as any)?.token || resp
      if (!token) throw new Error("Не удалось получить токен")
      setAuthToken(String(token))

      // Go straight to onboarding.
      router.push("/app/onboarding")
      router.refresh()
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка"

      // If email already exists, try login with the same credentials.
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("зарегистр")) {
        try {
          const resp = await login(email.trim(), password)
          const token = (resp as any)?.access_token || (resp as any)?.token || resp
          if (!token) throw new Error("Не удалось получить токен")
          setAuthToken(String(token))
          router.push("/app/onboarding")
          router.refresh()
          return
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : "Ошибка"
          setError(`Этот email уже зарегистрирован. Войдите: ${msg2}`)
          return
        }
      }

      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen wb-bg-soft">
      <header className="mx-auto max-w-5xl px-4 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 rounded-2xl wb-accent-bar shadow-md" />
            <div>
              <div className="text-xl font-extrabold wb-gradient-text leading-none">AVEOTVET</div>
              <div className="text-xs text-muted-foreground">Быстрый старт</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-xl">
              <Link href="/login">Войти</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/register">Регистрация</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <Card className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl shadow-black/5 backdrop-blur">
            <div className="text-sm text-muted-foreground">Шаг 1 из 3</div>
            <h1 className="mt-1 text-2xl font-bold">Создадим доступ</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Дальше мы автоматически переведём вас к подключению магазина и настройкам. Отдельно регистрироваться больше
              не нужно.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-2 rounded-xl"
                  type="email"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Пароль</label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="минимум 8 символов"
                  className="mt-2 rounded-xl"
                  type="password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Повторите пароль</label>
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ещё раз"
                  className="mt-2 rounded-xl"
                  type="password"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                  <div className="text-sm text-destructive">{error}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Если у вас уже есть аккаунт, просто перейдите на <Link className="underline" href="/login">страницу входа</Link>.
                  </div>
                </div>
              ) : null}

              <Button
                className="w-full rounded-2xl"
                size="lg"
                disabled={!canSubmit || isLoading}
                onClick={handleStart}
              >
                {isLoading ? "Подключаем…" : "Далее → подключить магазин"}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                Нажимая «Далее», вы соглашаетесь продолжить настройку сервиса.
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Что будет дальше</div>
              <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Шаг 2:</span> Добавите магазин (название + WB Token).
                </li>
                <li>
                  <span className="font-medium text-foreground">Шаг 3:</span> Выберете правила (авто/ручной режим, тон,
                  подписи по брендам).
                </li>
                <li>
                  <span className="font-medium text-foreground">Финал:</span> Нажмёте «Сохранить» и перейдёте в кабинет.
                </li>
              </ol>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/75 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Важно про токен</div>
              <p className="mt-2 text-sm text-muted-foreground">
                WB Token обязателен — он нужен, чтобы загрузить бренды и отзывы. Мы покажем подсказку, где его взять, прямо
                на шаге «Добавьте магазин».
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
