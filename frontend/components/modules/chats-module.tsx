"use client"

import { useState, useEffect } from "react"
import { Search, Download, RefreshCw, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listChats, syncChats } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"
import { toText } from "@/lib/safe-text"

interface ChatsModuleProps {
  shopId: number
}

interface ChatSession {
  chat_id: string
  client_name?: string
  last_message?: unknown
  updated_at?: string
}

export default function ChatsModule({ shopId }: ChatsModuleProps) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredChats = normalizedQuery
    ? chats.filter((c) => {
        const hay = `${c.client_name || ""} ${toText(c.last_message, 500)}`.toLowerCase()
        return hay.includes(normalizedQuery)
      })
    : chats

  const loadChats = async () => {
    setIsLoading(true)
    try {
      const data = await listChats(shopId, {
        limit: 50,
      })
      setChats(data || [])
    } catch (err) {
      console.error("[v0] Failed to load chats:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [shopId])

  const handleSync = async () => {
    try {
      const response = await syncChats(shopId)
      if (response.job_id) {
        pollJob(response.job_id, loadChats)
      }
    } catch (err) {
      console.error("[v0] Sync failed:", err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h2 className="text-xl font-semibold text-foreground">Чаты</h2>
        <p className="text-sm text-muted-foreground mt-1">Управление чатами с покупателями</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по чатам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isPolling || isLoading}
              className="gap-2 bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 ${isPolling ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          {pollError && <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">{pollError}</div>}

          {/* Empty State */}
          {!isLoading && chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-semibold text-foreground">Чатов нет</p>
              <p className="text-sm text-muted-foreground">Новые чаты будут отображаться здесь</p>
            </div>
          )}

          {/* Chats List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка чатов...</div>
          ) : (
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <div
                  key={chat.chat_id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{chat.client_name || "Клиент"}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{toText(chat.last_message, 200)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4">
                      {chat.updated_at ? new Date(chat.updated_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
