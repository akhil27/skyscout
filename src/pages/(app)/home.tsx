import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery } from 'deepspace'
import { APP_DISPLAY_NAME } from '../../constants'
import type { Outing } from '../../types'
import { NewOutingForm } from '../../components/NewOutingForm'
import { OutingCard } from '../../components/OutingCard'
import { ApodCard } from '../../components/ApodCard'
import { EmptyState } from '@/components/ui'

export default function HomePage() {
  const { isLoaded, isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const [showAuth, setShowAuth] = useState(false)
  const { records, status } = useQuery<Outing>('outings', { orderBy: 'createdAt', orderDir: 'desc', limit: 50 })

  if (!isLoaded) return <div className="p-8 text-sm text-slate-400">Loading…</div>

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">{APP_DISPLAY_NAME}</p>
        <h1 className="mt-3 text-3xl font-bold">Your crew&apos;s night sky, decided.</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-400">
          Sign in to create outings, vote on nights, and generate AI viewing guides with live cloud data.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-6 rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-200"
        >
          Sign in to start scouting
        </button>
        {showAuth ? <AuthOverlay onClose={() => setShowAuth(false)} /> : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Good evening{user?.name ? `, ${user.name.split(' ')[0]}` : ''} — pick a night.</h1>
          <p className="mt-1 text-sm text-slate-400">
            Outings sync live. Open one to check clouds, vote, and generate the guide.
          </p>
        </div>
        <Link to="/settings" className="text-xs text-slate-500 hover:text-slate-300">
          Settings
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <NewOutingForm />
          {status === 'loading' ? (
            <p className="text-sm text-slate-500">Loading outings…</p>
          ) : status === 'error' ? (
            <p className="text-sm text-rose-300">Could not load outings. Realtime reconnects automatically; check your connection.</p>
          ) : records.length === 0 ? (
            <EmptyState
              title="No outings yet"
              description="Create your first one above — try a dark-sky spot and two weekend nights."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {records.map((r) => (
                <OutingCard key={r.recordId} record={r} />
              ))}
            </div>
          )}
        </div>
        <div className="grid content-start gap-4">
          <ApodCard />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            <p className="font-semibold text-slate-200">How go/no-go works</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Organizer refreshes forecasts; nightly cron checks upcoming outings.</li>
              <li>Clouds dominate; humidity + bright moon dock points.</li>
              <li>70+ Go · 45–69 Maybe · below 45 pick another night.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
