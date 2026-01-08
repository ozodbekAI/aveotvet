"use client"

import { useState, useEffect } from "react"
import { Search, Download, Filter, ChevronDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FeedbacksList from "@/components/feedback/feedbacks-list"
import { syncFeedbacks, listFeedbacks } from "@/lib/api"
import { useSyncPolling } from "@/hooks/use-sync-polling"

interface FeedbacksModuleProps {
  shopId: number
}

export default function FeedbacksModule({ shopId }: FeedbacksModuleProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("waiting")
  const [feedbacks, setFeedbacks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const { isPolling, error: pollError, pollJob } = useSyncPolling()

  const loadFeedbacks = async () => {
    setIsLoading(true)
    try {
      const data = await listFeedbacks(shopId, {
        is_answered: activeTab === "waiting" ? false : undefined,
        q: searchQuery || undefined,
        limit: 50,
      })
      setFeedbacks(data || [])
    } catch (err) {
      console.error("[v0] Failed to load feedbacks:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFeedbacks()
  }, [shopId, activeTab, searchQuery])

  const handleSync = async () => {
    try {
      const response = await syncFeedbacks(shopId, {
        is_answered: false,
      })
      if (response.job_id) {
        pollJob(response.job_id, loadFeedbacks)
      }
    } catch (err) {
      console.error("[v0] Sync failed:", err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b border-border bg-card px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent border-b border-border gap-6 p-0 h-auto">
            <TabsTrigger
              value="waiting"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 rounded-none px-0 py-2"
            >
              Ожидают публикации
            </TabsTrigger>
            <TabsTrigger
              value="archive"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 rounded-none px-0 py-2"
            >
              Архив
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className="border-b-2 border-transparent data-[state=active]:border-blue-600 rounded-none px-0 py-2"
            >
              Рекомендации
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "waiting" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Статус или описание..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent"
                onClick={handleSync}
                disabled={isPolling || isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isPolling ? "animate-spin" : ""}`} />
                {isPolling ? "Синхронизация..." : "Синхронизировать"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Filter className="w-4 h-4" />
                Период
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                Все оценки
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                Текст
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4" />
              </Button>
            </div>

            {pollError && <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">{pollError}</div>}

            <FeedbacksList feedbacks={feedbacks} shopId={shopId} isLoading={isLoading} />
          </div>
        )}

        {activeTab === "archive" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Архив</p>
              <p className="text-sm text-muted-foreground">Отвеченные отзывы</p>
            </div>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Нет рекомендаций</p>
              <p className="text-sm text-muted-foreground">У вас нет материалов для рекомендаций</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
