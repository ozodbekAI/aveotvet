"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import ShopSelect from "@/components/admin/shop-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminCreatePayment, adminListPayments, getMe, type Payment } from "@/lib/api"

export default function PaymentsPage() {
  const [meRole, setMeRole] = useState<string | null>(null)
  const [shopId, setShopId] = useState<number | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [comment, setComment] = useState<string>("")
  const [rows, setRows] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amt = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) ? n : null
  }, [amount])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const me = await getMe()
      setMeRole(me.role)
      const list = await adminListPayments(shopId ? { shop_id: shopId } : undefined)
      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить платежи")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canCreate = meRole === "super_admin"

  const create = async () => {
    if (!shopId || !amt) return
    try {
      setLoading(true)
      setError(null)
      await adminCreatePayment({ shop_id: shopId, amount_rub: amt, comment: comment.trim() || undefined })
      setAmount("")
      setComment("")
      await load()
    } catch (e: any) {
      setError(e?.message || "Не удалось создать платеж")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Платежи</h1>
          <div className="text-sm text-muted-foreground">Админ: пополнения баланса (₽)</div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          Обновить
        </Button>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Фильтр</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <ShopSelect value={shopId} onChange={setShopId} />
          <Button variant="outline" onClick={load} disabled={loading}>
            Применить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Добавить платеж</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <ShopSelect value={shopId} onChange={setShopId} disabled={!canCreate} allowAll={false} placeholder="Выберите магазин" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" className="w-[160px]" />
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (необязательно)" className="w-[280px]" />
          <Button onClick={create} disabled={loading || !canCreate || !shopId || !amt}>
            Создать
          </Button>
          {!canCreate ? <div className="text-xs text-muted-foreground">Создание доступно только super_admin</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead className="text-right">Сумма, ₽</TableHead>
                <TableHead className="text-right">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.shop_id}</TableCell>
                  <TableCell className="text-right">{r.amount_rub}</TableCell>
                  <TableCell className="text-right">{r.created_at}</TableCell>
                </TableRow>
              ))}
              {!rows.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
