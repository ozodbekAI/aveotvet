"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ShopSelect from "@/components/admin/shop-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminExportLogs, adminListLogs } from "@/lib/api"

export default function LogsPage() {
  const [shopId, setShopId] = useState<number | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sid = shopId

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await adminListLogs(sid ? { shop_id: sid } : undefined)
      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить логи")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportCsv = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminExportLogs(sid ? { shop_id: sid } : undefined)
      if (res?.url) window.open(res.url, "_blank")
    } catch (e: any) {
      setError(e?.message || "Не удалось экспортировать")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <div className="text-sm text-muted-foreground">admin.logs.read / export</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            Обновить
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={loading}>
            Export
          </Button>
        </div>
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
          <CardTitle>Список (последние записи)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>time</TableHead>
                <TableHead>level</TableHead>
                <TableHead>event</TableHead>
                <TableHead>shop</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.id ?? idx}>
                  <TableCell className="text-xs">{r.created_at ?? r.time ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.level ?? r.severity ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.event ?? r.message ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.shop_id ?? "—"}</TableCell>
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
