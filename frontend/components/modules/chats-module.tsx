"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, Image as ImageIcon, MessageCircle, RefreshCw, Search } from "lucide-react"

import { useShop } from "@/components/shop-context"
import {
  listChatsPage,
  syncChats,
  type ChatSessionRow,
} from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { ChatDrawer } from "@/components/modules/chat-drawer"

type StatusFilter = "active" | "closed" | "all"

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

function fmtDate(iso: string) {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleDateString("ru-RU", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric",
  })
}

function getLastMessagePreview(session: ChatSessionRow) {
  const lm = session.last_message || {}
  const text = safeText(lm)
  return text || "—"
}

function getLastMessageDate(session: ChatSessionRow) {
  const lm = session.last_message || {}
  const tsMs =
    typeof lm.addTimestamp === "number" ? lm.addTimestamp : typeof lm.addTimestampMs === "number" ? lm.addTimestampMs : null
  if (tsMs) {
    const dt = new Date(tsMs)
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  return session.updated_at
}

function isActiveChat(session: ChatSessionRow): boolean {
  return (session.unread_count ?? 0) > 0
}

export default function ChatsModule() {
  const { shops, shopId, isSuperAdmin } = useShop()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [shopFilter, setShopFilter] = React.useState<number | null>(shopId)
  
  React.useEffect(() => {
    setShopFilter((prev) => (prev === null ? null : shopId))
  }, [shopId])

  const [rows, setRows] = useState<ChatSessionRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  
  const limit = 20
  const offsetRef = useRef(0)
  const loadLockRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const [active, setActive] = useState<ChatSessionRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentDetailIndex, setCurrentDetailIndex] = useState<number>(0)

  const fetchPage = useCallback(async (reset = false) => {
    if (loadLockRef.current) return
    loadLockRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const currentOffset = reset ? 0 : offsetRef.current
      const res = await listChatsPage({
        shopId: shopFilter ?? null,
        limit,
        offset: currentOffset,
        unread: statusFilter === "active" ? true : null,
      })

      let items = res.items || []

      items = [...items].sort((a, b) => {
        const da = new Date(getLastMessageDate(a)).getTime()
        const db = new Date(getLastMessageDate(b)).getTime()
        return db - da
      })

      if (reset) {
        setRows(items)
        offsetRef.current = limit
        setTotal(res.total || 0)
        setHasMore(items.length === limit)
      } else {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => `${r.shop_id}:${r.chat_id}`))
          let added = 0
          const next = [...prev]
          for (const r of items) {
            const key = `${r.shop_id}:${r.chat_id}`
            if (!seen.has(key)) {
              seen.add(key)
              next.push(r)
              added += 1
            }
          }
          if (added === 0) {
            setHasMore(false)
          } else {
            setHasMore(items.length === limit)
          }
          return next
        })
        offsetRef.current += limit
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load chats")
    } finally {
      setLoading(false)
      loadLockRef.current = false
    }
  }, [shopFilter, statusFilter])

  useEffect(() => {
    offsetRef.current = 0
    setHasMore(true)
    fetchPage(true)
  }, [fetchPage, shopFilter, statusFilter])

  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (!hasMore || loading) return
        fetchPage(false)
      },
      { root: scrollRef.current, rootMargin: "240px" },
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, fetchPage])

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter((r) => {
      const clientName = (r.client_name || "").toLowerCase()
      const productTitle = (r.product_title || "").toLowerCase()
      const productBrand = (r.product_brand || "").toLowerCase()
      return clientName.includes(q) || productTitle.includes(q) || productBrand.includes(q)
    })
  }, [rows, searchQuery])

  const displayRows = useMemo(() => {
    if (statusFilter === "all") return filteredRows
    if (statusFilter === "active") return filteredRows.filter((r) => isActiveChat(r))
    if (statusFilter === "closed") return filteredRows.filter((r) => !isActiveChat(r))
    return filteredRows
  }, [filteredRows, statusFilter])

  const unreadRows = useMemo(() => {
    return rows.filter((r) => (r.unread_count ?? 0) > 0)
  }, [rows])

  const openChat = (row: ChatSessionRow, index?: number) => {
    if (typeof index === "number") {
      setCurrentDetailIndex(index)
    }
    setActive(row)
    setDrawerOpen(true)
  }

  const goToPrev = useCallback(() => {
    if (currentDetailIndex <= 0) return
    const prevIndex = currentDetailIndex - 1
    const prevRow = unreadRows[prevIndex]
    if (!prevRow) return
    setCurrentDetailIndex(prevIndex)
    setActive(prevRow)
  }, [currentDetailIndex, unreadRows])

  const goToNext = useCallback(() => {
    if (currentDetailIndex >= unreadRows.length - 1) return
    const nextIndex = currentDetailIndex + 1
    const nextRow = unreadRows[nextIndex]
    if (!nextRow) return
    setCurrentDetailIndex(nextIndex)
    setActive(nextRow)
  }, [currentDetailIndex, unreadRows])

  const runSync = async () => {
    if (!shopFilter) {
      const ids = shops.map((s) => s.id)
      await Promise.allSettled(ids.map((id) => syncChats(id)))
    } else {
      await syncChats(shopFilter)
    }
    offsetRef.current = 0
    await fetchPage(true)
  }

  const statusLabel = statusFilter === "active" ? "Активные" : statusFilter === "closed" ? "Закрытые" : "Все"

  if (!shopId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="text-lg font-semibold text-foreground">Магазин не выбран</div>
          <div className="text-sm text-muted-foreground mt-2">Выберите магазин, чтобы работать с чатами.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Чаты — {statusLabel}</h1>
        <Button variant="outline" onClick={runSync} className="gap-2" disabled={loading || (!shopFilter && !isSuperAdmin)}>
          <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          Синхронизировать
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по покупателю или товару"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-11 rounded-xl border-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="closed">Закрытые</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto space-y-4">
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка…</div>
        ) : displayRows.length ? (
          displayRows.map((r, idx) => (
            <ChatCard key={`${r.shop_id}:${r.chat_id}`} row={r} shops={shops} onOpen={() => openChat(r, idx)} />
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground">Чатов не найдено</div>
        )}

        <div ref={sentinelRef} className="h-1" />
        
        {loading && rows.length > 0 && (
          <div className="p-4 text-center text-muted-foreground">Загрузка…</div>
        )}
      </div>

      <ChatDrawer
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v)
          if (!v) setActive(null)
        }}
        session={active}
        onSent={() => fetchPage(true)}
        onPrev={unreadRows.length > 1 ? goToPrev : undefined}
        onNext={unreadRows.length > 1 ? goToNext : undefined}
        currentIndex={currentDetailIndex}
        totalCount={unreadRows.length}
      />
    </div>
  )
}

interface ChatCardProps {
  row: ChatSessionRow
  shops: { id: number; name: string }[]
  onOpen: () => void
}

function ChatCard({ row, shops, onOpen }: ChatCardProps) {
  const isActive = isActiveChat(row)
  const lastDate = fmtDate(getLastMessageDate(row))
  const lastMessage = getLastMessagePreview(row)

  const marketplaceInfo = [
    "Wildberries",
    row.product_brand,
    row.nm_id ? `Арт. ${row.nm_id}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/5 transition-colors">
      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {row.product_thumb_url ? (
          <img src={row.product_thumb_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpen}
              className="text-base font-medium text-amber-600 dark:text-amber-500 hover:underline text-left line-clamp-1"
            >
              {row.product_title || "Товар"}
            </button>
            {isActive ? (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-0 gap-1">
                Активный
                {row.unread_count > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                    {row.unread_count}
                  </span>
                )}
              </Badge>
            ) : (
              <Badge variant="secondary" className="border-0">
                Закрыт
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">{lastDate}</span>
        </div>

        <div className="text-xs text-muted-foreground mt-1">
          {marketplaceInfo}
        </div>

        <div className="flex items-start gap-2 mt-2 text-sm text-foreground">
          <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <span className="line-clamp-1">{lastMessage}</span>
        </div>

        <div className="text-sm text-muted-foreground mt-2">
          Покупатель: {row.client_name || "Неизвестно"}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onOpen} className="gap-2 flex-shrink-0">
        Открыть
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  )
}
