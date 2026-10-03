/**
 * Landing page — STATIC. No auth/data hooks here by contract.
 * Marketing only; the live planner lives at /home.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_DISPLAY_NAME } from '../config'
import { seo } from '../seo'

const STEPS = [
  { n: '1', t: 'Name a spot + 2–3 nights', d: 'Choose a geocoded location, then refresh its five-day forecast.' },
  { n: '2', t: 'Vote go / maybe / no', d: 'Every date option gets a live tally. No group-chat archaeology.' },
  { n: '3', t: 'Get the AI viewing guide', d: 'What is up tonight, best window, and a 4-item packing checklist.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-[#0a0e1a] text-slate-100">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-200">
            {APP_DISPLAY_NAME}
          </span>
          <Link
            to="/home"
            className="rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-200"
          >
            Open the planner
          </Link>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-20">
          <p className="mt-10 text-sm uppercase tracking-widest text-slate-400">
            Small-group stargazing, settled
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
            Stop debating the sky. <span className="text-amber-300">Check it, vote, go.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">
            SkyScout turns &ldquo;maybe Friday?&rdquo; into a go/no-go: live cloud forecasts,
            a group vote per night, and an AI viewing guide for the winning date.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/home"
              className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-200"
            >
              Plan your first outing
            </Link>
            <span className="inline-flex items-center rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">
              Live clouds · Group votes · AI guides · Email reminders
            </span>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-300 font-bold text-slate-900">
                  {s.n}
                </div>
                <h2 className="mt-3 font-semibold">{s.t}</h2>
                <p className="mt-1 text-sm text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
            Built on DeepSpace: realtime records for votes, server actions for weather + AI,
            a nightly cron that refreshes forecasts, and background jobs for full-sky scouts.
          </div>
        </main>
      </div>
    </>
  )
}
