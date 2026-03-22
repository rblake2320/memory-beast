import type { StatusResponse } from '../api/types'

interface Props {
  status: StatusResponse | null
}

const STAT = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
    <div className="text-2xl font-bold text-sky-400 tabular-nums">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div className="text-xs text-slate-500 mt-1">{label}</div>
  </div>
)

export default function StatsGrid({ status }: Props) {
  if (!status) return null
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <STAT label="Memories" value={status.memory_count} />
      <STAT label="Sources" value={status.source_count} />
      <STAT label="Conversations" value={status.conversation_count} />
      <STAT label="Embeddings" value={status.embedding_count} />
    </div>
  )
}
