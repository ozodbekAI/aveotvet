"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, MessageCircle } from "lucide-react"

interface ChatSession {
  chat_id: string
  client_name: string
  last_message: string
  updated_at: string
}

interface ChatsListProps {
  shopId: number
  token: string
}

export default function ChatList({ shopId, token }: ChatsListProps) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/chats/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setChats(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Failed to load chats:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/chats/${shopId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        const interval = setInterval(async () => {
          const jobRes = await fetch(`/api/jobs/${data.job_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (jobRes.ok) {
            const job = await jobRes.json()
            if (job.status === "done") {
              clearInterval(interval)
              setIsSyncing(false)
              loadChats()
            } else if (job.status === "failed") {
              clearInterval(interval)
              setIsSyncing(false)
            }
          }
        }, 2000)
      }
    } catch (err) {
      console.error("Sync failed:", err)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chats</h1>
          <p className="text-muted-foreground mt-1">Manage customer conversations</p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {isSyncing ? "Syncing..." : "Sync Chats"}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading chats...</Card>
        ) : chats.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No chats yet
          </Card>
        ) : (
          chats.map((chat) => (
            <Card key={chat.chat_id} className="p-4 hover:bg-accent/10 cursor-pointer transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{chat.client_name}</h3>
                  <p className="text-sm text-foreground line-clamp-2 mt-1">{chat.last_message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(chat.updated_at).toLocaleString()}</p>
                </div>
                <Badge variant="outline">Active</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
