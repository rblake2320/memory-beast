import { useState } from 'react'
import { ThumbsUp, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/cn'
import TierBadge from './TierBadge'
import type { Memory, SearchResult } from '../api/types'

type Item = Memory | SearchResult

interface Props {
  item: Item
  onHelpful?: (id: number) => void
  onDelete?: (id: number) => void
  className?: string
}

function isMemory(item: Item): item is Memory {
  return 'belief_state' in item
}

const BELIEF_COLORS: Record<string, string> = {
  active: 'bg-emerald-500',
  shadow: 'bg-slate-500',
  disputed: 'bg-amber-500',
  superseded: 'bg-red-500',
  quarantined: 'bg-red-700',
}

export default function MemoryCard({ item, onHelpful, onDelete, className }: Props) {
  const [expanded, setExpanded] = useState(false)
  const tier = isMemory(item) ? item.derivation_tier : item.tier ?? 4
  const content = isMemory(item) ? item.fact : item.content
  const confidence = isMemory(item) ? item.confidence : item.score
  const beliefState = isMemory(item) ? item.belief_state : 'active'
  const hashFp = isMemory(item) ? item.fact_hash.slice(0, 8) : null
  const provenance = 'provenance' in item ? item.provenance : []

  return (
    <div className={cn(
      'bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={tier} />
          {isMemory(item) && (
            <span className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              BELIEF_COLORS[beliefState] ?? 'bg-slate-500'
            )} title={beliefState} />
          )}
          {hashFp && (
            <span className="text-[10px] font-mono text-slate-500">#{hashFp}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onHelpful && (
            <button
              onClick={() => onHelpful(item.id)}
              className="p-1 text-slate-500 hover:text-sky-400 transition-colors"
              title="Mark helpful"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fact content */}
      <p className="text-sm text-slate-200 leading-relaxed">{content}</p>

      {/* Confidence bar */}
      {confidence != null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-700 rounded-full h-1">
            <div
              className="bg-sky-400 rounded-full h-1 transition-all"
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {Math.round((confidence ?? 0) * 100)}%
          </span>
        </div>
      )}

      {/* Provenance toggle */}
      {provenance && provenance.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {provenance.length} provenance link{provenance.length !== 1 ? 's' : ''}
        </button>
      )}

      {expanded && provenance && (
        <div className="space-y-1 pt-1 border-t border-slate-700">
          {provenance.map((p, i) => (
            <div key={i} className="text-[11px] text-slate-500 font-mono">
              {p.source_path ? (
                <span className="text-slate-400">{p.source_path}</span>
              ) : (
                <span>src:{p.source_id} seg:{p.segment_id}</span>
              )}
              <span className="ml-2 text-slate-600">({p.derivation_type})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
