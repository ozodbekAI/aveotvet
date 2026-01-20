"use client"

import React from "react"

import { getMe } from "@/lib/api"
import {
  adminAdjustShopCredits,
  adminCreateShop,
  adminListUsers,
  adminListShops,
  adminUpdateShop,
  type AdminShop,
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
import { RefreshCw, Wallet, Store, ShieldCheck, Plus } from "lucide-react"

function fmt(n: number | null | undefined) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0
  return v.toLocaleString("ru-RU")
}

export default function AdminShopsModule() {
  const [meRole, setMeRole] = React.useState<string | null>(null)
  const canView = meRole === "super_admin" || meRole === "support_admin"
  const canEdit = meRole === "super_admin"

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [shops, setShops] = React.useState<AdminShop[]>([])

  const [users, setUsers] = React.useState<Array<{ id: number; email: string }>>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createOwnerId, setCreateOwnerId] = React.useState<string>("")
  const [createName, setCreateName] = React.useState<string>("")
  const [createToken, setCreateToken] = React.useState<string>("")

  const [creditsOpen, setCreditsOpen] = React.useState(false)
  const [creditsShop, setCreditsShop] = React.useState<AdminShop | null>(null)
  const [creditsDelta, setCreditsDelta] = React.useState<string>("")
  const [creditsReason, setCreditsReason] = React.useState<string>("")

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await getMe()
      setMeRole(me?.role || null)
      if (!(me?.role === "super_admin" || me?.role === "support_admin")) {
        setShops([])
        setUsers([])
        return
      }

      const s = await adminListShops()
      setShops(Array.isArray(s) ? s : [])

      if (me.role === "super_admin") {
        const u = await adminListUsers()
        // adminListUsers returns more fields; we keep only what's needed in this module
        setUsers(
          Array.isArray(u)
            ? u
                .map((x: any) => ({ id: Number(x?.id), email: String(x?.email || "") }))
                .filter((x) => Number.isFinite(x.id) && x.id > 0)
            : [],
        )
      } else {
        setUsers([])
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить данные")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const totals = React.useMemo(() => {
    const cnt = (shops || []).length
    const balance = (shops || []).reduce((acc, s) => acc + (Number(s?.credits_balance) || 0), 0)
    const spent = (shops || []).reduce((acc, s) => acc + (Number(s?.credits_spent) || 0), 0)
    return { cnt, balance, spent }
  }, [shops])

  const handleCreate = React.useCallback(async () => {
    if (!canEdit) return
    setLoading(true)
    setError(null)
    try {
      const owner_user_id = Number.parseInt(createOwnerId, 10)
      if (!Number.isFinite(owner_user_id) || owner_user_id <= 0) {
        throw new Error("Укажите владельца")
      }
      await adminCreateShop({ owner_user_id, name: createName.trim(), wb_token: createToken.trim() })
      setCreateOpen(false)
      setCreateOwnerId("")
      setCreateName("")
      setCreateToken("")
      await load()
    } catch (e: any) {
      setError(e?.message || "Не удалось создать магазин")
    } finally {
      setLoading(false)
    }
  }, [canEdit, createOwnerId, createName, createToken, load])

  const handleToggleActive = React.useCallback(
    async (shop: AdminShop) => {
      if (!canEdit) return
      setLoading(true)
      setError(null)
      try {
        await adminUpdateShop(shop.id, { is_active: !shop.is_active })
        await load()
      } catch (e: any) {
        setError(e?.message || "Не удалось обновить магазин")
      } finally {
        setLoading(false)
      }
    },
    [canEdit, load],
  )

  const openCredits = (shop: AdminShop) => {
    setCreditsShop(shop)
    setCreditsDelta("")
    setCreditsReason("")
    setCreditsOpen(true)
  }

  const handleCredits = React.useCallback(async () => {
    if (!creditsShop) return
    if (!canEdit) return
    setLoading(true)
    setError(null)
    try {
      const delta = Number.parseInt(creditsDelta, 10)
      if (!Number.isFinite(delta) || delta === 0) throw new Error("Укажите delta")
      await adminAdjustShopCredits(creditsShop.id, { delta, reason: creditsReason.trim() || undefined })
      setCreditsOpen(false)
      setCreditsShop(null)
      await load()
    } catch (e: any) {
      setError(e?.message || "Не удалось изменить баланс")
    } finally {
      setLoading(false)
    }
  }, [canEdit, creditsShop, creditsDelta, creditsReason, load])

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Админ-панель: магазины</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Доступ только для глобальных администраторов.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Админ-панель: магазины
          </h1>
          <div className="text-sm text-muted-foreground">Управление магазинами и их балансами.</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>

          {canEdit ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={loading}>
                  <Plus className="h-4 w-4" />
                  Создать магазин
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Создать магазин</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Владелец</Label>
                  <Select value={createOwnerId} onValueChange={setCreateOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пользователя" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.email} (ID: {u.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">Можно выбрать существующего пользователя.</div>
                </div>

                <div className="space-y-2">
                  <Label>Название магазина</Label>
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Avemod" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>WB token</Label>
                  <Input value={createToken} onChange={(e) => setCreateToken(e.target.value)} placeholder="eyJ..." />
                  <div className="text-xs text-muted-foreground">Токен хранится на backend. В UI повторно не отображается.</div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={loading}>
                  Отмена
                </Button>
                <Button onClick={handleCreate} disabled={loading || !createOwnerId || !createName.trim() || !createToken.trim()}>
                  Создать
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="text-xs text-muted-foreground">Режим только чтение (support_admin).</div>
          )}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Магазинов</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmt(totals.cnt)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Общий баланс</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmt(totals.balance)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Потрачено</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmt(totals.spent)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список магазинов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Владелец</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Баланс</TableHead>
                  <TableHead className="text-right">Потрачено</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.length ? (
                  shops.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">ID: {s.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.owner_email || "—"}
                        <div className="text-xs text-muted-foreground">ID: {s.owner_user_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.is_active ? (
                          <span className="rounded-md bg-emerald-500/10 text-emerald-600 px-2 py-1 text-xs">Активен</span>
                        ) : (
                          <span className="rounded-md bg-muted px-2 py-1 text-xs">Отключён</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(s.credits_balance)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(s.credits_spent)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openCredits(s)} className="gap-2">
                                <Wallet className="h-4 w-4" />
                                Баланс
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleToggleActive(s)} disabled={loading}>
                                {s.is_active ? "Отключить" : "Включить"}
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Только просмотр</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      {loading ? "Загрузка…" : "Магазинов нет"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />

          <div className="text-xs text-muted-foreground">
            Изменение баланса: delta может быть положительным (пополнение) или отрицательным (списание). 
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Изменить баланс</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Магазин: {creditsShop?.name ?? "—"}</div>
            <div className="space-y-2">
              <Label>Delta (например, 500 или -200)</Label>
              <Input value={creditsDelta} onChange={(e) => setCreditsDelta(e.target.value)} placeholder="500" />
            </div>
            <div className="space-y-2">
              <Label>Причина (необязательно)</Label>
              <Input value={creditsReason} onChange={(e) => setCreditsReason(e.target.value)} placeholder="Topup" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button onClick={handleCredits} disabled={loading || !creditsDelta.trim()}>
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
