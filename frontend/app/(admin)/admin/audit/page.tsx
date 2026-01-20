"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ShopSelect from "@/components/admin/shop-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminAuditList } from "@/lib/api"

export default function AuditPage() {
  const [shopId, setShopId] = useState<number | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sid = shopId

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await adminAuditList(sid ? { shop_id: sid } : undefined)

      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить аудит")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Аудит</h1>
          <div className="text-sm text-muted-foreground">admin.audit.read</div>
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
          <CardTitle>События</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>created_at</TableHead>
                <TableHead>actor_id</TableHead>
                <TableHead>action</TableHead>
                <TableHead>entity</TableHead>
                <TableHead className="text-right">details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.id ?? idx}>
                  <TableCell>{r.created_at ?? "—"}</TableCell>
                  <TableCell>{r.actor_id ?? "—"}</TableCell>
                  <TableCell>{r.action ?? r.event_type ?? "—"}</TableCell>
                  <TableCell>{r.entity ?? r.scope ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground line-clamp-1">{JSON.stringify(r.details ?? r.meta ?? {})}</span>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
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
