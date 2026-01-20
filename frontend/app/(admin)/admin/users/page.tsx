"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

import { getMe, adminListUsers, adminSetUserRole } from "@/lib/api"

type UserRow = {
  id: number
  email: string
  role: string
  is_active: boolean
}

// Backend global roles
const ROLE_OPTIONS = [
  { value: "super_admin", label: "Суперадмин" },
  { value: "support_admin", label: "Админ поддержки" },
  { value: "user", label: "Пользователь" },
]

export default function AdminUsersPage() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null)
  const [meId, setMeId] = React.useState<number | null>(null)
  const [meRole, setMeRole] = React.useState<string | null>(null)
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<number | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await getMe()
      const canView = me?.role === "super_admin" || me?.role === "support_admin"
      setAllowed(canView)
      setMeId(me?.id ?? null)
      setMeRole(me?.role ?? null)
      if (!canView) return
      const data = await adminListUsers()
      setUsers(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const canEditRoles = meRole === "super_admin"

  const changeRole = async (userId: number, role: string) => {
    if (!canEditRoles) return
    if (meId && userId === meId) return
    setSavingId(userId)
    setError(null)
    try {
      await adminSetUserRole(userId, role)
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить")
    } finally {
      setSavingId(null)
    }
  }

  if (allowed === false) {
    return (
      <div className="max-w-3xl">
        <div className="text-2xl font-bold text-foreground">Доступ запрещён</div>
        <div className="text-sm text-muted-foreground mt-2">Раздел доступен только глобальным администраторам.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-foreground">Админ: пользователи</div>
        <div className="text-sm text-muted-foreground">Управление ролями пользователей (глобально).</div>
        {!canEditRoles ? (
          <div className="text-xs text-muted-foreground mt-1">Режим только чтение (роль support_admin).</div>
        ) : null}
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Список пользователей</CardTitle>
          <Button variant="outline" className="border-border" onClick={refresh} disabled={loading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Активен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users || []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => changeRole(u.id, v)}
                        disabled={!canEditRoles || savingId === u.id || (meId !== null && u.id === meId)}
                      >
                        <SelectTrigger className="bg-input border-border text-foreground w-[200px]">
                          <SelectValue placeholder="Роль" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-foreground">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{u.is_active ? "Да" : "Нет"}</TableCell>
                  </TableRow>
                ))}
                {(!users || users.length === 0) && !loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Пользователи отсутствуют.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
