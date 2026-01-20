"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createShop } from "@/lib/api"

type ShopOut = {
  id: number
  name: string
  wb_token?: string | null
}

type Props = {
  onCreated?: (shop: ShopOut) => void
  trigger?: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export default function CreateShopDialog({ onCreated, trigger, defaultOpen, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen))
  const isControlled = typeof open === "boolean"
  const actualOpen = isControlled ? Boolean(open) : internalOpen
  const setOpen = (v: boolean) => {
    onOpenChange?.(v)
    if (!isControlled) setInternalOpen(v)
  }
  const [name, setName] = React.useState("")
  const [wbToken, setWbToken] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    const n = name.trim()
    const t = wbToken.trim()
    
    if (!n) {
      setError("Введите название магазина")
      return
    }
    
    if (!t) {
      setError("Введите WB токен")
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      const shop = await createShop({ name: n, wb_token: t })
      setName("")
      setWbToken("")
      setOpen(false)
      onCreated?.(shop as ShopOut)
    } catch (e: any) {
      setError(e?.message || "Не удалось создать магазин")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[520px]">

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Название магазина</Label>
            <Input 
              id="shop-name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Например: UNI TY"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wb-token">WB токен</Label>
            <Input 
              id="wb-token"
              value={wbToken} 
              onChange={(e) => setWbToken(e.target.value)} 
              placeholder="Введите токен Wildberries"
              disabled={loading}
              type="password"
            />
            <div className="text-sm text-muted-foreground">
              Токен нужен для интеграции с Wildberries API
            </div>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Создание…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}