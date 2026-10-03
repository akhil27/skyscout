import { Link } from 'react-router-dom'
import type { RecordData } from 'deepspace'
import { GoBadge } from './GoBadge'
import { computeGoScore, formatScoreDate } from '@/lib/sky'
import type { Outing } from '@/types'

export function OutingCard({ record }: { record: RecordData<Outing> }) {
  const o = record.data
  return (
    <Link
      to={`/outings/${record.recordId}`}
      className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-amber-300/40 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold leading-tight">{o.title}</h3>
          <p className="mt-0.5 text-sm text-slate-400">{o.placeName}</p>
        </div>
        <GoBadge score={computeGoScore(o.weatherCache ?? [], o.chosenDate ?? o.dateOptions?.[0] ?? '').score} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(o.dateOptions ?? []).slice(0, 4).map((d) => (
          <span
            key={d}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              o.chosenDate === d
                ? 'border-amber-300/50 bg-amber-300/10 text-amber-200'
                : 'border-slate-700 text-slate-400'
            }`}
          >
            {formatScoreDate(d)}
          </span>
        ))}
      </div>
      {o.guide ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-400">{o.guide}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No viewing guide yet — open to scout.</p>
      )}
    </Link>
  )
}
