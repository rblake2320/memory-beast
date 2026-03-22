import { useState, useCallback } from 'react'
import { searchMemories } from '../api/search'
import type { SearchResponse } from '../api/types'

export function useSearch() {
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string, tier?: 1 | 2 | 3) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await searchMemories({ query, k: 20, force_tier: tier })
      setResults(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, error, search }
}
