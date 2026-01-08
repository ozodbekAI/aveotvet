"use client"

import { useState, useEffect } from "react"
import { Search, Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HelpCircle } from "lucide-react"
import { syncQuestions, listQuestions } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

interface QuestionsModuleProps {
  shopId: number
}

interface Question {
  id: string
  wb_id?: string
  text?: string
  user_name?: string
  created_date?: string
  answered?: boolean
}

export default function QuestionsModule({ shopId }: QuestionsModuleProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const loadQuestions = async () => {
    setIsLoading(true)
    try {
      const data = await listQuestions(shopId, {
        is_answered: false,
        q: searchQuery || undefined,
        limit: 50,
      })
      setQuestions(data || [])
    } catch (err) {
      console.error("[v0] Failed to load questions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [shopId, searchQuery])

  const handleSync = async () => {
    try {
      const response = await syncQuestions(shopId, {
        is_answered: false,
      })
      if (response.job_id) {
        pollJob(response.job_id, loadQuestions)
      }
    } catch (err) {
      console.error("[v0] Sync failed:", err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h2 className="text-xl font-semibold text-foreground">Вопросы - Ожидают публикации</h2>
        <p className="text-sm text-muted-foreground mt-1">Вопросы, на которые нужно ответить</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по вопросам..."
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
              {isPolling ? "Синхронизация..." : "Синхронизировать"}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          {pollError && <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">{pollError}</div>}

          {/* Empty State */}
          {!isLoading && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-semibold text-foreground">Вопросов нет</p>
              <p className="text-sm text-muted-foreground">Все вопросы отвечены</p>
            </div>
          )}

          {/* Questions List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка вопросов...</div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.wb_id || q.id} className="p-4 border border-border rounded-lg hover:bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{q.text}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{q.user_name}</span>
                    <span>{q.created_date ? new Date(q.created_date).toLocaleDateString() : ""}</span>
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
