"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, HelpCircle, Settings, Store, PlusCircle } from "lucide-react"

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
    { href: "/feedbacks", label: "Отзывы", icon: MessageSquare },
    { href: "/questions", label: "Вопросы", icon: HelpCircle },
    { href: "/chat", label: "Чаты", icon: Store },
    { href: "/settings", label: "Настройки", icon: Settings },
  ]

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      <div className="p-4">
        <h1 className="text-xl font-bold text-gray-900">OTVETO</h1>
        <p className="text-sm text-gray-500">Менеджер Wildberries</p>
      </div>

      <Separator />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Магазин</span>
          <Button variant="ghost" size="sm" onClick={onAddShop} className="h-7 px-2">
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={selectedShopId ? selectedShopId.toString() : ""}
          onValueChange={(value) => onShopChange(parseInt(value, 10))}
          disabled={shops.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={shops.length ? "Выберите магазин" : "Магазинов нет"} />
          </SelectTrigger>
          <SelectContent>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id.toString()}>
                {shop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <nav className="flex-1 p-4 space-y-2">
        {nav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "default" : "ghost"}
                className="w-full justify-start"
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
