"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Filter, RefreshCw } from "lucide-react"

import { useShop } from "@/components/shop-context"
import {
  listChatsPage,
  syncChats,
  type ChatSessionRow,
} from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { ChatDrawer } from "@/components/modules/chat-drawer"

type StatusFilter = {
  unread: boolean
  read: boolean
  unanswered: boolean
  answered: boolean
}

const DEFAULT_STATUS: StatusFilter = {
  unread: false,
  read: false,
  unanswered: false,
  answered: false,
}

function safeText(v: any): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v === "number") return String(v)
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text
    if (typeof v.message === "string") return v.message
  }
  return ""
}

function fmtDateTime(iso: string) {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  const dd = dt.toLocaleDateString("ru-RU")
  const tt = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  return `${dd}\n${tt}`
}

function getLastMessagePreview(session: ChatSessionRow) {
  const lm = session.last_message || {}
  const text = safeText(lm)
  return text || "—"
}

function getLastMessageDate(session: ChatSessionRow) {
  // prefer lastMessage.addTimestamp if present, otherwise updated_at
  const lm = session.last_message || {}
  const tsMs =
    typeof lm.addTimestamp === "number" ? lm.addTimestamp : typeof lm.addTimestampMs === "number" ? lm.addTimestampMs : null
  if (tsMs) {
    const dt = new Date(tsMs)
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  return session.updated_at
}

function isAnswered(session: ChatSessionRow): boolean | null {
  // WB payloads differ; try several heuristics.
  const lm = session.last_message || {}
  const from = (lm.from || lm.sender || lm.author || lm.userType || "") as any
  if (typeof lm.isMy === "boolean") return lm.isMy
  if (typeof lm.isSeller === "boolean") return lm.isSeller
  if (typeof from === "string") {
    const s = from.toLowerCase()
    if (s.includes("seller") || s.includes("operator") || s.includes("support")) return true
    if (s.includes("buyer") || s.includes("client") || s.includes("user")) return false
  }
  return null
}

export default function ChatsModule() {
  const { shops, shopId, isSuperAdmin } = useShop()

  const [shopFilter, setShopFilter] = React.useState<number | null>(shopId)
  React.useEffect(() => {
    // keep in sync with global selection unless user picked "all"
    setShopFilter((prev) => (prev === null ? null : shopId))
  }, [shopId])

  const [status, setStatus] = React.useState<StatusFilter>(DEFAULT_STATUS)

  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({})
  const [rangeOpen, setRangeOpen] = React.useState(false)

  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc")

  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [rows, setRows] = React.useState<ChatSessionRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [active, setActive] = React.useState<ChatSessionRow | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const offset = (page - 1) * pageSize

  const appliedUnread = status.unread && !status.read ? true : status.read && !status.unread ? false : null

  const appliedDateFrom = range.from ? Math.floor(new Date(range.from.setHours(0, 0, 0, 0)).getTime() / 1000) : null
  const appliedDateTo = range.to ? Math.floor(new Date(range.to.setHours(23, 59, 59, 999)).getTime() / 1000) : null

  const fetchPage = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listChatsPage({
        shopId: shopFilter ?? null,
        limit: pageSize,
        offset,
        dateFromUnix: appliedDateFrom,
        dateToUnix: appliedDateTo,
        unread: appliedUnread,
      })

      let items = res.items || []

      // client-side filtering for answered/unanswered (backend does not currently persist that status reliably)
      if (status.answered || status.unanswered) {
        items = items.filter((it) => {
          const ans = isAnswered(it)
          if (status.answered && ans === true) return true
          if (status.unanswered && ans === false) return true
          return false
        })
      }

      // client-side sort toggle (backend default desc)
      items = [...items].sort((a, b) => {
        const da = new Date(getLastMessageDate(a)).getTime()
        const db = new Date(getLastMessageDate(b)).getTime()
        return sortDir === "desc" ? db - da : da - db
      })

      setRows(items)
      setTotal(res.total || 0)
    } catch (e: any) {
      setError(e?.message || "Failed to load chats")
    } finally {
      setLoading(false)
    }
  }, [appliedDateFrom, appliedDateTo, appliedUnread, offset, pageSize, shopFilter, sortDir, status.answered, status.unanswered])

  React.useEffect(() => {
    fetchPage()
  }, [fetchPage])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openChat = (row: ChatSessionRow) => {
    setActive(row)
    setDrawerOpen(true)
  }

  const runSync = async () => {
    // for "all shops" we trigger sync per shop from UI (best-effort).
    if (!shopFilter) {
      const ids = shops.map((s) => s.id)
      await Promise.allSettled(ids.map((id) => syncChats(id)))
    } else {
      await syncChats(shopFilter)
    }
    await fetchPage()
  }

  const statusCount = Object.values(status).filter(Boolean).length

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                Период
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="p-1">
                <Calendar
                  mode="range"
                  selected={{ from: range.from, to: range.to } as any}
                  onSelect={(v: any) => setRange({ from: v?.from, to: v?.to })}
                  numberOfMonths={2}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRange({})
                      setRangeOpen(false)
                      setPage(1)
                    }}
                  >
                    Сбросить
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setRangeOpen(false)
                      setPage(1)
                      fetchPage()
                    }}
                  >
                    Применить
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                Статус
                {statusCount > 0 ? <Badge variant="secondary">{statusCount}</Badge> : null}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-3" align="start">
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={status.unread} onCheckedChange={(v) => setStatus((s) => ({ ...s, unread: Boolean(v) }))} />
                  Непрочитанные
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={status.read} onCheckedChange={(v) => setStatus((s) => ({ ...s, read: Boolean(v) }))} />
                  Прочитанные
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={status.unanswered} onCheckedChange={(v) => setStatus((s) => ({ ...s, unanswered: Boolean(v) }))} />
                  Неотвеченные
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={status.answered} onCheckedChange={(v) => setStatus((s) => ({ ...s, answered: Boolean(v) }))} />
                  Отвеченные
                </label>

                <Button
                  className="mt-2"
                  onClick={() => {
                    setPage(1)
                    fetchPage()
                  }}
                >
                  Применить
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="min-w-[220px]">
            <Select
              value={shopFilter === null ? "all" : String(shopFilter)}
              onValueChange={(v) => {
                setPage(1)
                setShopFilter(v === "all" ? null : Number(v))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все магазины" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все магазины</SelectItem>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={runSync} className="gap-2" disabled={loading || (!shopFilter && !isSuperAdmin)}>
            <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
            Синхронизировать
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">На странице:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Последнее сообщение</TableHead>
              <TableHead>Пользователь</TableHead>
              <TableHead className="text-center">Непрочитанных сообщений</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}>
                <div className="flex items-center gap-1">
                  Дата
                  {sortDir === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-destructive py-10 text-center">
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  Чатов не найдено
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.shop_id}:${r.chat_id}`} onClick={() => openChat(r)} className="cursor-pointer">
                  <TableCell className="whitespace-normal">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getLastMessagePreview(r)}</span>
                          {r.shop_name ? <span className="text-muted-foreground text-xs">• {r.shop_name}</span> : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">{r.client_name || "—"}</TableCell>
                  <TableCell className="text-center">
                    {r.unread_count > 0 ? <Badge variant="default">{r.unread_count}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="whitespace-pre-line text-sm">{fmtDateTime(getLastMessageDate(r))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.max(1, p - 1))
                }}
              />
            </PaginationItem>

            {(() => {
              const links: React.ReactNode[] = []
              const pushPage = (p: number) =>
                links.push(
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault()
                        setPage(p)
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>,
                )

              const max = totalPages
              const windowSize = 5
              const start = Math.max(1, page - 2)
              const end = Math.min(max, start + windowSize - 1)

              if (start > 1) {
                pushPage(1)
                if (start > 2) links.push(<PaginationItem key="e1"><PaginationEllipsis /></PaginationItem>)
              }
              for (let p = start; p <= end; p++) pushPage(p)
              if (end < max) {
                if (end < max - 1) links.push(<PaginationItem key="e2"><PaginationEllipsis /></PaginationItem>)
                pushPage(max)
              }
              return links
            })()}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.min(totalPages, p + 1))
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <div className="text-muted-foreground text-sm">Всего: {total}</div>
      </div>

      <ChatDrawer
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v)
          if (!v) setActive(null)
        }}
        session={active}
        onSent={fetchPage}
      />
    </div>
  )
}
