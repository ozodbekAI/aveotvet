"use client"

import { useState, useCallback } from "react"
import { getJobStatus } from "@/lib/api"

export function useSyncPolling() {
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollJob = useCallback(async (jobId: number, onDone?: () => void) => {
    setIsPolling(true)
    setError(null)

    const maxAttempts = 120 // 2 minutes with 1s interval
    let attempts = 0

    const poll = async () => {
      try {
        const job = await getJobStatus(jobId)
        console.log("[v0] Job status:", job)

        if (job.status === "done") {
          setIsPolling(false)
          onDone?.()
        } else if (job.status === "failed") {
          setError(job.last_error || "Job failed")
          setIsPolling(false)
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 1000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling error")
        setIsPolling(false)
      }
    }

    poll()
  }, [])

  return { isPolling, error, pollJob }
}
