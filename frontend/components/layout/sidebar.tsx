"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  HelpCircle,
  Settings,
  MessageCircle,
  FileText,
  PlusCircle,
  Home,
  Wallet,
  UsersRound,
} from "lucide-react"

import type { ShopBilling, ShopOut, ShopRole } from "@/lib/api"

interface SidebarProps {
  shops: ShopOut[]
  selectedShopId: number | null
  onShopChange: (shopId: number) => void
  onAddShop?: () => void
  selectedShopRole?: ShopRole | null
  shopBilling?: ShopBilling | null
  shopBillingLoading?: boolean
  canCreateShop?: boolean
}

function roleRank(role: ShopRole | null | undefined) {
  switch (role) {
    case "owner":
      return 4
    case "manager":
      return 3
    default:
      return 0
  }
}

function can(role: ShopRole | null | undefined, min: ShopRole) {
  return roleRank(role) >= roleRank(min)
}

function roleLabel(role: ShopRole) {
  switch (role) {
    case "owner":
      return "Владелец"
    case "manager":
      return "Менеджер"
    default:
      return "—"
  }
}

export default function Sidebar({
  shops,
  selectedShopId,
  onShopChange,
  onAddShop, // ✅ MUHIM: bu yerda destructuring bo‘lishi shart
  selectedShopRole,
  shopBilling,
  shopBillingLoading,
  canCreateShop,
}: SidebarProps) {
  const pathname = usePathname()

  const nav = [
    { href: "/app/dashboard", label: "Главная", icon: Home },
    { href: "/app/feedbacks", label: "Отзывы", icon: MessageSquare },
    { href: "/app/questions", label: "Вопросы", icon: HelpCircle },
    { href: "/app/drafts", label: "Черновики", icon: FileText },
    { href: "/app/chat", label: "Чаты", icon: MessageCircle },
  ]

  const isOwner = selectedShopRole === "owner"
  const canSettings = Boolean(can(selectedShopRole, "manager"))

  // TZ: billing + team are owner-only in v1.
  if (isOwner) {
    nav.push({ href: "/app/billing", label: "Баланс", icon: Wallet })
    nav.push({ href: "/app/team", label: "Команда", icon: UsersRound })
  }
  if (canSettings) {
    nav.push({ href: "/app/settings", label: "Настройки", icon: Settings })
  }

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-4">
        <h1 className="text-2xl font-bold wb-gradient-text">AVEOTVET</h1>
        <p className="text-xs text-muted-foreground mt-1">Feedback Manager</p>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Магазин</span>

          {/* ✅ bu yerda canCreateShop va onAddShop ikkalasi ham bo‘lsa button chiqadi */}
          {canCreateShop && onAddShop ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddShop}
              className="h-7 w-7 p-0 rounded-xl text-primary hover:bg-secondary/70"
              aria-label="Добавить магазин"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <Select
          value={selectedShopId ? selectedShopId.toString() : ""}
          onValueChange={(value) => onShopChange(Number.parseInt(value, 10))}
          disabled={shops.length === 0}
        >
          <SelectTrigger className="w-full bg-input border-border text-foreground rounded-xl">
            <SelectValue placeholder={shops.length ? "Выберите магазин" : "Магазинов нет"} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id.toString()} className="text-foreground">
                {shop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isOwner ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Баланс магазина</div>
            {selectedShopRole ? (
              <div className="text-xs text-muted-foreground mt-1">Роль: {roleLabel(selectedShopRole)}</div>
            ) : null}

            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div className="text-lg font-semibold text-foreground">
                {shopBillingLoading ? "…" : shopBilling?.credits_balance ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">кредитов</div>
            </div>

            {shopBilling?.credits_spent !== undefined ? (
              <div className="text-xs text-muted-foreground mt-1">Потрачено: {shopBilling.credits_spent}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))

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
    </div>
  )
}
