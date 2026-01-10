"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Download, RefreshCw, MessageCircle, Send } from "lucide-react"
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
  const router = useRouter()
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
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border bg-white px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground">AVEOTVET Чаты</h2>
        <p className="text-sm text-muted-foreground mt-1">Управляйте всеми чатами с клиентами</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg border border-border shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или сообщению..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
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
              {isPolling ? "Синх..." : "Синх"}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          {pollError && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/20">
              {pollError}
            </div>
          )}

          {!isLoading && chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-border/50">
              <MessageCircle className="w-20 h-20 text-muted-foreground mb-4 opacity-30" />
              <p className="text-lg font-semibold text-foreground">Чатов нет</p>
              <p className="text-sm text-muted-foreground">Новые чаты появятся здесь</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка чатов...</div>
          ) : (
            <div className="space-y-3">
              {filteredChats.map((chat) => (
                <div
                  key={chat.chat_id}
                  className="p-4 bg-white border border-border rounded-lg hover:shadow-md hover:border-primary/30 cursor-pointer transition-all duration-200 group"
                  onClick={() => router.push(`/chat/${encodeURIComponent(chat.chat_id)}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">
                        {chat.client_name || "Клиент"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-2 line-clamp-2">
                        {toText(chat.last_message, 150) || "(нет сообщений)"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <Send className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {chat.updated_at ? new Date(chat.updated_at).toLocaleDateString() : ""}
                      </span>
                    </div>
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
