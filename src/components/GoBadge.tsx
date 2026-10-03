import { cn } from '@/lib/utils'

export function GoBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-slate-400">Forecast unavailable</span>
  const label = score >= 70 ? 'Go' : score >= 45 ? 'Maybe' : 'No-go'
  const cls =
    label === 'Go'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : label === 'Maybe'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        cls,
      )}
    >
      <span aria-hidden>●</span> {label} · {score}
    </span>
  )
}
