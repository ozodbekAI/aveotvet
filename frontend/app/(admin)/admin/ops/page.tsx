"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ShopSelect from "@/components/admin/shop-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getMe, adminOpsStatus, adminOpsSyncRun, adminOpsRetryFailed, adminOpsKillSwitch, type OpsStatus } from "@/lib/api"

export default function OpsPage() {
  const [meRole, setMeRole] = useState<string | null>(null)
  const [shopId, setShopId] = useState<number | null>(null)
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canKillSwitch = meRole === "super_admin"

  const sid = shopId

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [me, st] = await Promise.all([getMe(), adminOpsStatus()])
      setMeRole(me.role)
      setStatus(st)
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить статус")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const run = async (fn: () => Promise<any>) => {
    try {
      setLoading(true)
      setError(null)
      await fn()
      await load()
    } catch (e: any) {
      setError(e?.message || "Операция не выполнена")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ops</h1>
          <div className="text-sm text-muted-foreground">Очереди, воркеры, ошибки</div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          Обновить
        </Button>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">jobs_pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{status?.jobs_pending ?? "…"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">jobs_failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{status?.jobs_failed ?? "…"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">jobs_retrying</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{status?.jobs_retrying ?? "…"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">avg_generation_time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{status?.avg_generation_time ?? "…"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Действия по магазину</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ShopSelect value={shopId} onChange={setShopId} allowAll={false} placeholder="Выберите магазин" />
            <Button variant="outline" disabled={!sid || loading} onClick={() => run(() => adminOpsSyncRun(sid!))}>
              Запустить sync
            </Button>
            <Button
              variant="outline"
              disabled={!sid || loading}
              onClick={() => run(() => adminOpsRetryFailed(sid!))}
            >
              Перезапустить упавшие
            </Button>
            <Button
              variant="destructive"
              disabled={!sid || loading || !canKillSwitch}
              onClick={() => run(() => adminOpsKillSwitch(sid!, true))}
            >
              Kill-switch ON
            </Button>
            <Button
              variant="outline"
              disabled={!sid || loading || !canKillSwitch}
              onClick={() => run(() => adminOpsKillSwitch(sid!, false))}
            >
              Kill-switch OFF
            </Button>
            {!canKillSwitch ? (
              <div className="text-xs text-muted-foreground">Kill-switch доступен только super_admin</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ошибки (24ч)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>error_type</TableHead>
                <TableHead className="text-right">count_24h</TableHead>
                <TableHead className="text-right">last_seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(status?.errors_24h || []).map((e) => (
                <TableRow key={e.error_type}>
                  <TableCell>{e.error_type}</TableCell>
                  <TableCell className="text-right">{e.count_24h}</TableCell>
                  <TableCell className="text-right">{e.last_seen}</TableCell>
                </TableRow>
              ))}
              {!(status?.errors_24h || []).length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
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
