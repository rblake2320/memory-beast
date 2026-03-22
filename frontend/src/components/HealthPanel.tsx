import { cn } from '../lib/cn'
import type { StatusResponse } from '../api/types'

interface Props {
  status: StatusResponse | null
  loading?: boolean
}

const DOT = ({ ok }: { ok: boolean }) => (
  <span className={cn(
    'inline-block w-2 h-2 rounded-full',
    ok ? 'bg-emerald-400' : 'bg-red-400'
  )} />
)

export default function HealthPanel({ status, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-slate-700 rounded w-1/3" />
          <div className="h-2 bg-slate-800 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!status) return null

  const ph = status.pipeline_health
  const pct = ph.total > 0 ? Math.round((ph.done / ph.total) * 100) : 100

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">System Health</h3>
        <span className="text-[10px] text-slate-500 font-mono uppercase">{status.status}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-1.5">
          <DOT ok={status.db === 'ok'} />
          <span className="text-xs text-slate-400">Database</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DOT ok={status.ollama === 'ok'} />
          <span className="text-xs text-slate-400">Ollama</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DOT ok={ph.failed === 0} />
          <span className="text-xs text-slate-400">Pipeline</span>
        </div>
      </div>

      {/* Pipeline progress */}
      <div>
        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
          <span>Pipeline</span>
          <span>{ph.done}/{ph.total} done</span>
        </div>
        <div className="bg-slate-700 rounded-full h-1.5">
          <div
            className="bg-sky-400 rounded-full h-1.5 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
