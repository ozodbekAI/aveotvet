"use client"

import React from "react"

import { useShop } from "@/components/shop-context"
import {
  addShopMember,
  deleteShopMember,
  listShopMembers,
  type ShopMember,
  type ShopRole,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Plus, Trash2, UsersRound } from "lucide-react"

// TZ v1: team is owner-only, and the only inviteable role is "manager".
const ROLE_OPTIONS: ShopRole[] = ["manager"]

export default function TeamModule() {
  const { shopId, selectedShop, shopRole, refresh, me } = useShop()

  const canView = shopRole === "owner"
  const canEdit = shopRole === "owner"

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [members, setMembers] = React.useState<ShopMember[]>([])

  const [addOpen, setAddOpen] = React.useState(false)
  const [addEmail, setAddEmail] = React.useState("")
  const [addRole, setAddRole] = React.useState<ShopRole>("manager")

  const load = React.useCallback(async () => {
    if (!shopId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const data = await listShopMembers(shopId)
      setMembers(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить список сотрудников")
    } finally {
      setLoading(false)
    }
  }, [shopId, canView])

  React.useEffect(() => {
    load()
  }, [load])

  const handleAdd = React.useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    setError(null)
    try {
      const payload: any = { email: addEmail.trim(), role: addRole }
      await addShopMember(shopId, payload)
      setAddEmail("")
      setAddRole("manager")
      setAddOpen(false)
      await Promise.all([load(), refresh()])
    } catch (e: any) {
      setError(e?.message || "Не удалось добавить сотрудника")
    } finally {
      setLoading(false)
    }
  }, [shopId, addEmail, addRole, load, refresh])

  const handleRemove = React.useCallback(
    async (userId: number) => {
      if (!shopId) return
      const ok = window.confirm("Удалить сотрудника из магазина?")
      if (!ok) return
      setLoading(true)
      setError(null)
      try {
        await deleteShopMember(shopId, userId)
        await load()
      } catch (e: any) {
        setError(e?.message || "Не удалось удалить сотрудника")
      } finally {
        setLoading(false)
      }
    },
    [shopId, load],
  )

  if (!shopId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Команда</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Сначала выберите магазин.</CardContent>
      </Card>
    )
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Команда</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Доступ ограничен вашей ролью.</div>
          <div className="text-muted-foreground">Для просмотра списка сотрудников требуется роль «Менеджер» или «Владелец».</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            Команда
          </h1>
          <div className="text-sm text-muted-foreground">Магазин: {selectedShop?.name ?? `#${shopId}`}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>

          {canEdit ? (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={loading}>
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Добавить сотрудника</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="user@example.com" />
                  </div>

                  <div className="space-y-2">
                    <Label>Роль</Label>
                    <Select value={addRole} onValueChange={(v) => setAddRole(v as ShopRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Инвайт по email: пользователь сам установит пароль через ссылку.
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)} disabled={loading}>
                    Отмена
                  </Button>
                  <Button onClick={handleAdd} disabled={loading || !addEmail.trim()}>
                    Добавить
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length ? (
                  members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="text-sm">{m.email || `ID: ${m.user_id}`}</TableCell>
                      <TableCell className="text-sm">
                        <span>
                          {m.role}
                          {me?.id && m.user_id === me.id ? " (вы)" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const isSelf = Boolean(me?.id && m.user_id === me.id)
                          const isOwnerRole = m.role === "owner"
                          const canRemoveThisRow = Boolean(canEdit && !isSelf && !isOwnerRole)

                          if (!canRemoveThisRow) return <span className="text-sm text-muted-foreground">—</span>

                          return (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemove(m.user_id)}
                              disabled={loading}
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить
                            </Button>
                          )
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      {loading ? "Загрузка…" : "Нет сотрудников"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />

          <div className="text-xs text-muted-foreground">
            Роли: owner (владелец, полный доступ) и manager (работа с отзывами/вопросами/чатами и базовые настройки).
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
