import { api } from './client'
import type { SearchResponse } from './types'

export interface SearchRequest {
  query: string
  k?: number
  filters?: Record<string, unknown>
  include_superseded?: boolean
  force_tier?: 1 | 2 | 3
}

export const searchMemories = (req: SearchRequest): Promise<SearchResponse> =>
  api.post<SearchResponse>('/api/search', req)
