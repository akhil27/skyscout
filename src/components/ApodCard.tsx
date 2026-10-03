import { useAsyncResource, useAuth } from 'deepspace'
import { callAction } from '@/lib/callAction'

interface Apod {
  title?: string
  explanation?: string
  url?: string
  media_type?: string
  date?: string
}

/**
 * Tonight's inspiration — NASA APOD, developer-billed, auth-gated.
 * Four states per integration guidance: loading / error+retry / empty / success.
 */
export function ApodCard() {
  const { isSignedIn } = useAuth()
  const apod = useAsyncResource<Apod | null>(
    async () => {
      const d = await callAction<Apod | Apod[]>('getApod')
      return Array.isArray(d) ? (d[0] ?? null) : d
    },
    [],
    { enabled: isSignedIn },
  )

  if (!isSignedIn) return null
  if (apod.status === 'loading' || apod.status === 'idle')
    return <div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">Loading tonight&apos;s sky…</div>
  if (apod.status === 'error')
    return (
      <div className="rounded-2xl border border-rose-900/50 p-4 text-sm">
        <p className="text-rose-300">Sky photo unavailable: {apod.error}</p>
        <button
          onClick={() => {
            apod.reload()
          }}
          className="mt-2 rounded-full border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
        >
          Retry in place
        </button>
      </div>
    )
  if (!apod.data) return <div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">No sky photo tonight.</div>

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      {apod.data.media_type === 'image' && apod.data.url ? (
        <img src={apod.data.url} alt={apod.data.title ?? 'Astronomy photo'} className="h-40 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">Tonight&apos;s inspiration · NASA</p>
        <p className="mt-1 font-semibold">{apod.data.title ?? 'Astronomy Picture of the Day'}</p>
        {apod.data.explanation ? (
          <p className="mt-1 line-clamp-3 text-sm text-slate-400">{apod.data.explanation}</p>
        ) : null}
      </div>
    </div>
  )
}
