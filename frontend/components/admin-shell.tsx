"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { clearAuthToken } from "@/lib/auth"
import { getMe } from "@/lib/api"

import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  Shield,
  Store,
  Users,
  Wrench,
} from "lucide-react"

type Me = { id: number; email: string; role: string }

function isSuper(role?: string | null) {
  return role === "super_admin"
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getMe()
        if (mounted) setMe(data)
      } catch {
        if (mounted) setMe(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const nav = useMemo(() => {
    const superOnly = isSuper(me?.role)
    const items = [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, show: superOnly },
      { href: "/admin/ops", label: "Ops", icon: Activity, show: true },
      { href: "/admin/shops", label: "Магазины", icon: Store, show: true },
      { href: "/admin/users", label: "Пользователи", icon: Users, show: true },
      { href: "/admin/payments", label: "Платежи", icon: CreditCard, show: superOnly },
      { href: "/admin/logs", label: "Логи", icon: Wrench, show: true },
      { href: "/admin/audit", label: "Аудит", icon: ScrollText, show: true },
      { href: "/admin/ai", label: "AI", icon: Settings2, show: superOnly },
      { href: "/admin/prompts", label: "Промпты", icon: Shield, show: superOnly },
    ]
    return items.filter((i) => i.show)
  }, [me?.role])

  const handleLogout = () => {
    clearAuthToken()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="h-screen flex bg-background">
      <aside className="flex h-full w-72 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-5">
          <div className="text-2xl font-bold wb-gradient-text">AVEOTVET</div>
          <div className="text-xs text-muted-foreground mt-1">Admin Panel</div>
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="px-5 py-3">
          <div className="text-xs text-muted-foreground">Вы вошли как</div>
          <div className="font-medium text-foreground truncate">{me?.email || "…"}</div>
          <div className="text-xs text-muted-foreground mt-1">Роль: {me?.role || "…"}</div>
        </div>

        <Separator className="bg-sidebar-border" />

        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={
                    "w-full justify-start text-sm rounded-xl transition-colors " +
                    (active
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "text-sidebar-foreground hover:bg-secondary/70")
                  }
                >
                  <Icon className={"mr-2 h-4 w-4 " + (active ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="p-4">
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-xl"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
