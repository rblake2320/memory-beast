// Mirrors MemoryWeb Pydantic schemas

export interface Memory {
  id: number
  fact: string
  category: string | null
  confidence: number | null
  importance: number | null
  belief_state: 'active' | 'shadow' | 'disputed' | 'superseded' | 'quarantined'
  derivation_tier: 1 | 2 | 3 | 4 | 5
  source_class: 'first_person' | 'third_person' | 'system_observed' | 'assistant_generated' | 'external_document' | 'unknown'
  valid_from: string | null
  valid_until: string | null
  transaction_time: string
  created_at: string
  tombstoned_at: string | null
  corroboration_count: number
  base_trust: number | null
  fact_hash: string
  search_keywords: string[]
  provenance?: ProvenanceChain[]
}

export interface ProvenanceChain {
  memory_id: number
  segment_id: number | null
  message_id: number | null
  source_id: number | null
  derivation_type: string
  source_path?: string
}

export interface SearchResult {
  result_type: string
  id: number
  content: string
  score: number
  tier: number
  provenance: ProvenanceChain[]
  tombstoned: boolean
  tags?: Array<{ axis: string; value: string; confidence: number | null }>
}

export interface SearchResponse {
  query: string
  total: number
  results: SearchResult[]
  tiers_used: number[]
  latency_ms: number
}

export interface StatusResponse {
  status: string
  memory_count: number
  source_count: number
  conversation_count: number
  embedding_count: number
  pipeline_health: {
    done: number
    pending: number
    running: number
    failed: number
    total: number
  }
  db: string
  ollama: string
}

export interface AnswerCertificate {
  id: number
  query_text: string
  answer_text: string | null
  confidence: number | null
  stale_reason: string | null
  stale_at: string | null
  cleared_at: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  tenant_id: string
  plan: string
}
