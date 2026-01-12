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

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super admin" },
  { value: "shop_owner", label: "Shop owner" },
  { value: "shop_staff", label: "Shop staff" },
  { value: "user", label: "User" },
]

export default function AdminUsersPage() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null)
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<number | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await getMe()
      const isAdmin = me?.role === "super_admin"
      setAllowed(isAdmin)
      if (!isAdmin) return
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

  const changeRole = async (userId: number, role: string) => {
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
        <div className="text-sm text-muted-foreground mt-2">Раздел доступен только главному администратору.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-foreground">Админ: пользователи</div>
        <div className="text-sm text-muted-foreground">Управление ролями пользователей (глобально).</div>
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
                      <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={savingId === u.id}>
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
