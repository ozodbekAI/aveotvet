"use client"

import { useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminFinance, adminSystemHealth, type FinanceBreakdownOut, type SystemHealth } from "@/lib/api"

type Period = "today" | "last_7_days" | "last_30_days" | "all_time"

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>("today")
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [finance, setFinance] = useState<FinanceBreakdownOut | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const [h, f] = await Promise.all([adminSystemHealth(), adminFinance(period)])
        if (!mounted) return
        setHealth(h)
        setFinance(f)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "Не удалось загрузить данные")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [period])

  const cards = useMemo(() => {
    const h = health
    return [
      { label: "Активных магазинов", value: h?.active_shops ?? "…" },
      { label: "Ошибки синка", value: h?.shops_with_sync_errors ?? "…", warn: (h?.shops_with_sync_errors ?? 0) > 0 },
      { label: "Очередь генерации", value: h?.generation_queue_size ?? "…", warn: (h?.generation_queue_size ?? 0) > 0 },
      { label: "Ошибки генерации (24ч)", value: h?.generation_errors_24h ?? "…", warn: (h?.generation_errors_24h ?? 0) > 0 },
      { label: "Автопубликация включена", value: h?.autopublish_enabled_shops ?? "…" },
      { label: "Ошибки автопубликации (24ч)", value: h?.autopublish_errors_24h ?? "…", warn: (h?.autopublish_errors_24h ?? 0) > 0 },
    ]
  }, [health])

  const summary = finance?.summary
  const breakdown = finance?.breakdown || []
  const topShops = finance?.top_shops || []
  const incidents = finance?.incidents || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">Операционный обзор: health + finance</div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Сегодня</SelectItem>
            <SelectItem value="last_7_days">Последние 7 дней</SelectItem>
            <SelectItem value="last_30_days">Последние 30 дней</SelectItem>
            <SelectItem value="all_time">За всё время</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={c.warn ? "border-destructive/50" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{loading ? "…" : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Finance summary */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Финансы ({period})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Получено</div>
              <div className="text-2xl font-semibold">{summary?.money_received_rub ?? "…"} ₽</div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">GPT cost</div>
              <div className="text-2xl font-semibold">{summary?.gpt_cost_rub ?? "…"} ₽</div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Gross</div>
              <div className="text-2xl font-semibold">{summary?.gross_result_rub ?? "…"} ₽</div>
            </div>

            {/* Optional: show exact interval */}
            {summary?.date_from && summary?.date_to ? (
              <div className="pt-2 text-xs text-muted-foreground">
                {new Date(summary.date_from).toLocaleString()} — {new Date(summary.date_to).toLocaleString()}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>GPT расходы по операциям</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">Cost (₽)</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((r) => (
                  <TableRow key={r.operation_type}>
                    <TableCell>{r.operation_type}</TableCell>
                    <TableCell className="text-right">{r.gpt_cost_rub}</TableCell>
                    <TableCell className="text-right">{r.percent}%</TableCell>
                  </TableRow>
                ))}
                {!breakdown.length ? (
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

      {/* Extra blocks: top shops + incidents */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top shops</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead className="text-right">Generations</TableHead>
                  <TableHead className="text-right">GPT cost (₽)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topShops.map((s) => (
                  <TableRow key={s.shop_id}>
                    <TableCell>{s.shop}</TableCell>
                    <TableCell className="text-right">{s.generations_count}</TableCell>
                    <TableCell className="text-right">{s.gpt_cost_rub}</TableCell>
                  </TableRow>
                ))}
                {!topShops.length ? (
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

        <Card>
          <CardHeader>
            <CardTitle>Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Incident</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i, idx) => (
                  <TableRow key={`${i.shop_id}-${i.incident_type}-${idx}`}>
                    <TableCell>{i.shop}</TableCell>
                    <TableCell>{i.incident_type}</TableCell>
                  </TableRow>
                ))}
                {!incidents.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
