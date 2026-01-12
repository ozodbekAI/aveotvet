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

  // Poll multiple jobs in parallel. Consider the whole operation done when ALL jobs are done.
  // If any job fails, stop and surface its error.
  const pollJobs = useCallback(async (jobIds: number[], onDone?: () => void) => {
    const uniq = Array.from(new Set((jobIds || []).filter((x) => Number.isFinite(x) && x > 0)))
    if (!uniq.length) {
      onDone?.()
      return
    }

    setIsPolling(true)
    setError(null)

    const maxAttempts = 240 // 4 minutes with 1s interval
    let attempts = 0

    const poll = async () => {
      try {
        const statuses = await Promise.all(uniq.map((id) => getJobStatus(id)))

        const failed = statuses.find((j: any) => j?.status === "failed")
        if (failed) {
          setError(failed?.last_error || "Job failed")
          setIsPolling(false)
          return
        }

        const allDone = statuses.every((j: any) => j?.status === "done")
        if (allDone) {
          setIsPolling(false)
          onDone?.()
          return
        }

        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 1000)
          return
        }

        setError("Timeout while waiting for jobs")
        setIsPolling(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling error")
        setIsPolling(false)
      }
    }

    poll()
  }, [])

  return { isPolling, error, pollJob, pollJobs }
}
