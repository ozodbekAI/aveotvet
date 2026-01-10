"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, HelpCircle, Settings, MessageCircle, FileText, PlusCircle, Home } from "lucide-react"

interface Shop {
  id: number
  name: string
}

interface SidebarProps {
  shops: Shop[]
  selectedShopId: number | null
  onShopChange: (shopId: number) => void
  onAddShop: () => void
}

export default function Sidebar({ shops, selectedShopId, onShopChange, onAddShop }: SidebarProps) {
  const pathname = usePathname()

  const nav = [
    { href: "/dashboard", label: "Главная", icon: Home },
    { href: "/feedbacks", label: "Отзывы", icon: MessageSquare },
    { href: "/questions", label: "Вопросы", icon: HelpCircle },
    { href: "/drafts", label: "Черновики", icon: FileText },
    { href: "/chat", label: "Чаты", icon: MessageCircle },
    { href: "/settings", label: "Настройки", icon: Settings },
  ]

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          AVEOTVET
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Feedback Manager</p>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Магазин</span>
          <Button variant="ghost" size="sm" onClick={onAddShop} className="h-6 px-2 text-primary hover:bg-secondary">
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={selectedShopId ? selectedShopId.toString() : ""}
          onValueChange={(value) => onShopChange(Number.parseInt(value, 10))}
          disabled={shops.length === 0}
        >
          <SelectTrigger className="w-full bg-input border-border text-foreground">
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
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "default" : "ghost"}
                className={`w-full justify-start text-sm ${
                  active
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-sidebar-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
