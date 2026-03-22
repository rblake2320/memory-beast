import { cn } from '../lib/cn'

const TIER_LABELS: Record<number, string> = {
  1: 'USER',
  2: 'BEHAVIOR',
  3: 'INFERRED',
  4: 'SYNTHESIZED',
  5: 'EXTERNAL',
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  2: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  3: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  4: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  5: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

interface Props {
  tier: number
  className?: string
}

export default function TierBadge({ tier, className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border',
      TIER_COLORS[tier] ?? TIER_COLORS[5],
      className
    )}>
      T{tier} {TIER_LABELS[tier] ?? 'UNKNOWN'}
    </span>
  )
}
