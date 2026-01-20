"use client"

import Link from "next/link"
import React from "react"

import { useShop } from "@/components/shop-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Wallet, RefreshCw, Shield } from "lucide-react"

function fmtMoney(n: number | null | undefined) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0
  return v.toLocaleString("ru-RU")
}

export default function BillingModule() {
  const { shopId, selectedShop, billing, isSuperAdmin, shopRole, refresh } = useShop()

  // TZ: store billing is owner-only.
  const canManage = shopRole === "owner"

  if (!shopId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Баланс</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Сначала выберите магазин.</CardContent>
      </Card>
    )
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Баланс</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Доступ ограничен вашей ролью.</div>
          <div className="text-muted-foreground">Для просмотра баланса требуется роль «Владелец».</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Баланс</h1>
          <div className="text-sm text-muted-foreground">Магазин: {selectedShop?.name ?? `#${shopId}`}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Баланс магазина
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Доступно</div>
              <div className="text-3xl font-semibold">{fmtMoney(billing?.credits_balance)} кр.</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Потрачено</div>
              <div className="text-lg font-medium">{fmtMoney(billing?.credits_spent)} кр.</div>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
              Пополнение баланса выполняется администратором системы. Владелец магазина может запросить пополнение у
              глобального администратора.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Последние операции</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead className="text-right">Изменение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(billing?.recent || []).length ? (
                    billing!.recent.map((it, idx) => (
                      <TableRow key={String(it.id ?? idx)}>
                        <TableCell className="text-sm text-muted-foreground">
                          {it.created_at ? new Date(it.created_at).toLocaleString("ru-RU") : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{it.reason || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {it.delta > 0 ? "+" : ""}
                          {fmtMoney(it.delta)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">
                        Нет операций.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
