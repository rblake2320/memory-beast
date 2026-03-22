import { useState, useEffect } from 'react'
import { getStatus } from '../api/status'
import type { StatusResponse } from '../api/types'

export function useStatus(intervalMs = 30_000) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function fetch() {
      try {
        const s = await getStatus()
        if (active) { setStatus(s); setError(null) }
      } catch (e) {
        if (active) setError(String(e))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => { active = false; clearInterval(id) }
  }, [intervalMs])

  return { status, loading, error }
}
