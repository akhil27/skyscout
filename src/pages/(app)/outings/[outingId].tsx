import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useAuthProfileReady,
  useJobs,
  useMutations,
  useQuery,
  useR2Files,
} from 'deepspace'
import { Button, Input, Textarea, useToast, Badge } from '@/components/ui'
import { GoBadge } from '@/components/GoBadge'
import { PresenceBar } from '@/components/PresenceBar'
import { callAction } from '@/lib/callAction'
import { computeGoScore, formatScoreDate } from '@/lib/sky'
import { SCOPE_ID } from '@/constants'
import type { Outing, OutingComment, Vote } from '@/types'

type Choice = 'go' | 'maybe' | 'no'

export default function OutingDetailPage() {
  const { outingId } = useParams()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { user, isSignedIn, isLoaded } = useAuthProfileReady({ requireUser: true })
  const { success, error } = useToast()
  const userId = user?.id ?? ''

  const outings = useQuery<Outing>('outings', { where: { recordId: outingId ?? '' }, limit: 1 })
  const outing = outings.records.find((r) => r.recordId === outingId)
  const o = outing?.data

  const votesQ = useQuery<Vote>('votes', outingId ? { where: { outingId }, limit: 200 } : undefined)
  const commentsQ = useQuery<OutingComment>('outing_comments', outingId ? { where: { outingId }, limit: 100 } : undefined)
  const outingMut = useMutations<Outing>('outings')
  const voteMut = useMutations<Vote>('votes')
  const commentMut = useMutations<OutingComment>('outing_comments')
  const jobs = useJobs<{ outingId: string }>(SCOPE_ID)
  const files = useR2Files({ scope: 'app' })

  const [busy, setBusy] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)

  const tally = useMemo(() => {
    const t: Record<string, Record<Choice, number>> = {}
    for (const v of votesQ.records) {
      const opt = v.data.option
      t[opt] ??= { go: 0, maybe: 0, no: 0 }
      if (v.data.choice === 'go' || v.data.choice === 'maybe' || v.data.choice === 'no') t[opt][v.data.choice] += 1
    }
    return t
  }, [votesQ.records])

  if (!isLoaded) return <div className="p-8 text-sm text-slate-400">Loading account…</div>
  if (!isSignedIn) return <div className="p-8">Sign in to view crew outings. <Link className="underline" to="/home">Open sign-in</Link></div>
  if (outings.status === 'error') return <div className="p-8" role="alert">Connection failed. Realtime reconnects automatically. <Link to="/home">Back to outings</Link></div>
  if (!outingId) return <div className="p-8 text-sm">Missing outing id.</div>
  if (outings.status === 'loading') return <div className="p-8 text-sm text-slate-400">Loading outing…</div>
  if (!outing || !o) return <div className="p-8 text-sm">Outing not found. <Link className="underline" to="/home">Back</Link></div>

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      error(label, String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(null)
    }
  }

  const vote = async (option: string, choice: Choice) => {
    const mine = votesQ.records.find((v) => v.data.option === option && v.createdBy === userId)
    if (mine) await voteMut.putConfirmed(mine.recordId, { choice })
    else await voteMut.createConfirmed({ outingId: outingId!, option, choice })
  }

  const canEdit = outingMut.ready && !!user && user.role !== 'viewer'
  const canScout = canEdit && user?.role === 'admin'
  const selectedDate = o.chosenDate ?? o.dateOptions?.[0] ?? ''
  const forecast = computeGoScore(o.weatherCache ?? [], selectedDate)
  const guideCurrent = o.guideDate === selectedDate
  const latestJob = jobs.jobs.find((j) => j.type === 'scout-outing' && j.payload?.outingId === outingId)
  const scoutJob = jobs.jobs.find((j) => j.type === 'scout-outing' && (j.payload as { outingId?: string } | undefined)?.outingId === outingId && (j.status === 'queued' || j.status === 'running'))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to="/home" className="text-sm text-slate-400 hover:text-slate-200">← All outings</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{o.title}</h1>
          <p className="mt-0.5 text-slate-400">{o.placeName}</p>
        </div>
        <GoBadge score={forecast.score} />
      </div>
      <div className="mt-2">
        <PresenceBar outingId={outingId} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          {/* Weather + guide */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Sky check</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!canScout || busy !== null} onClick={() => run('Refreshing weather…', async () => { await callAction('refreshWeather', { outingId }); success('Forecast refreshed') })}>
                  {busy ? 'Working…' : 'Refresh weather'}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-400">{forecast.reason}</p>
            {!canScout ? <p className="mt-2 text-xs text-amber-200">The organizer refreshes weather and AI; crew members can vote and post notes.</p> : null}
            {latestJob ? <p role="status" className="mt-2 text-xs text-slate-400">Full scout: {latestJob.status}{latestJob.error ? ` — ${latestJob.error}` : ''} {scoutJob?.progressMessage ?? ''}</p> : null}
            {o.weatherAt ? <p className="mt-1 text-xs text-slate-500">Updated {new Date(o.weatherAt).toLocaleString()}</p> : <p className="mt-1 text-xs text-slate-500">No forecast yet — refresh to attach one.</p>}
            {o.weatherCache?.length ? (
              <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                {o.weatherCache.filter((w) => Math.abs(w.dt * 1000 - Date.parse(selectedDate)) <= 6 * 3600000).slice(0, 6).map((w, i) => (
                  <li key={i} className="rounded-lg bg-slate-800/60 px-3 py-1.5 text-slate-300">
                    {new Date(w.dt * 1000).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })} · {w.description ?? '—'} · {Math.round(w.temp)}°C
                  </li>
                ))}
              </ul>
            ) : null}

            <h2 className="mt-5 font-semibold">Viewing guide</h2>
            {o.guide && guideCurrent ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{o.guide}</p> : <p className="mt-2 text-sm text-slate-500">No guide yet. Generate one — it uses the cached forecast.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={!canScout || busy !== null} onClick={() => run('Generating guide…', async () => { await callAction('generateGuide', { outingId }); success('Guide ready') })}>
                Generate guide
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canScout || busy !== null || !jobs.connected || !!scoutJob}
                onClick={() => run('Scout queued…', async () => { await jobs.enqueue('scout-outing', { outingId }); success('Full scout running in background') })}
              >
                {scoutJob ? `Scouting… ${Math.round((scoutJob.progress ?? 0) * 100)}%` : 'Full scout (background job)'}
              </Button>
            </div>
            {o.guideAt ? <p className="mt-1 text-xs text-slate-500">Guide via {o.guideModel ?? 'AI'} · {new Date(o.guideAt).toLocaleString()}</p> : null}
          </section>

          {/* Votes */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold">Vote on nights</h2>
            <p className="mt-1 text-sm text-slate-400">One vote per night — tap to change. Tallies update live for the whole crew.</p>
            {votesQ.status === 'error' ? <p role="alert" className="mt-2 text-sm text-rose-300">Votes unavailable; waiting for realtime reconnection.</p> : null}
            <div className="mt-3 grid gap-3">
              {(o.dateOptions ?? []).map((opt) => {
                const t = tally[opt] ?? { go: 0, maybe: 0, no: 0 }
                const mine = votesQ.records.find((v) => v.data.option === opt && v.createdBy === userId)?.data.choice
                return (
                  <div key={opt} className="rounded-xl border border-slate-800 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatScoreDate(opt)}</span>
                        <GoBadge score={computeGoScore(o.weatherCache ?? [], opt).score} />
                        {o.chosenDate === opt ? <Badge>Crew pick</Badge> : null}
                      </div>
                      <span className="text-xs text-slate-400">✅ {t.go} · 🤷 {t.maybe} · ❌ {t.no}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(['go', 'maybe', 'no'] as Choice[]).map((c) => (
                        <Button
                          key={c}
                          size="sm"
                          variant={mine === c ? 'default' : 'outline'}
                          disabled={!canEdit || !voteMut.ready || busy !== null}
                          onClick={() => run('Voting…', async () => { await vote(opt, c) })}
                        >
                          {c === 'go' ? '✅ Go' : c === 'maybe' ? '🤷 Maybe' : '❌ No'}
                        </Button>
                      ))}
                      {o.chosenDate !== opt ? (
                        <Button size="sm" variant="ghost" disabled={!canEdit || busy !== null} onClick={() => run('Setting pick…', async () => { await outingMut.putConfirmed(outingId, { chosenDate: opt }); success('Crew pick updated') })}>
                          Set as pick
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Discussion */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold">Crew notes</h2>
            <div className="mt-3 grid gap-2">
              {commentsQ.status === 'loading' ? <p className="text-sm text-slate-500">Loading crew notes…</p> : null}
              {commentsQ.status === 'error' ? <p role="alert" className="text-sm text-rose-300">Notes unavailable; waiting for realtime reconnection.</p> : null}
              {commentsQ.status === 'ready' && commentsQ.records.length === 0 ? <p className="text-sm text-slate-500">No notes yet — who is bringing the telescope?</p> : null}
              {commentsQ.records.map((c) => (
                <div key={c.recordId} className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-200">
                  {c.data.body}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input maxLength={2000} value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Telescope, snacks, parking tip…" aria-label="New note" />
              <Button
                disabled={!canEdit || !commentMut.ready || busy !== null || !commentDraft.trim()}
                onClick={() => run('Posting…', async () => { await commentMut.createConfirmed({ outingId: outingId!, body: commentDraft.trim() }); setCommentDraft('') })}
              >
                Post
              </Button>
            </div>
          </section>
        </div>

        <div className="grid content-start gap-4">
          {/* Reminder */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold">Email reminder</h2>
            <p className="mt-1 text-sm text-slate-400">Sends the selected-night score + guide to the organizer’s verified account email. Limited to once per minute.</p>
            <div className="mt-3 grid gap-2">
              <p className="break-all text-sm text-slate-400">{user?.email}</p>
              <Button
                variant="outline"
                disabled={!canScout || busy !== null || !user?.email}
                onClick={() => run('Sending…', async () => { await callAction('sendReminder', { outingId }); success('Reminder sent to your account email') })}
              >
                Send reminder
              </Button>
            </div>
          </section>

          {/* Photo */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="font-semibold">Sky photo</h2>
            {o.photoUrl ? <img src={o.photoUrl} alt="Crew sky photo" className="mt-3 rounded-xl" loading="lazy" /> : <p className="mt-2 text-sm text-slate-500">After the outing, upload one crew shot. App-scoped photos have public URLs; do not upload private images.</p>}
            <label className="mt-3 block">
              <span className="text-xs text-slate-400">Upload JPG/PNG (≤10 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={!canEdit || photoBusy}
                className="mt-1 block w-full text-sm text-slate-300"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (!['image/jpeg', 'image/png'].includes(f.type)) { error('Unsupported photo', 'Choose a JPG or PNG.'); return }
                  if (f.size > 10 * 1024 * 1024) {
                    error('Too large', 'Keep photos under 10 MB.')
                    return
                  }
                  setPhotoBusy(true)
                  files
                    .upload(f, f.name, { key: `outings/${outingId}/${Date.now()}-${f.name}` })
                    .then((r) => {
                      if (!r.success || !r.url) throw new Error(r.error ?? 'Upload returned no image URL.')
                      return outingMut.putConfirmed(outingId, { photoUrl: r.url })
                    })
                    .then(() => success('Photo uploaded'))
                    .catch((err: unknown) => error('Upload failed', String(err instanceof Error ? err.message : err)))
                    .finally(() => setPhotoBusy(false))
                }}
              />
            </label>
          </section>

          {/* Details */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
            <p><span className="text-slate-200 font-medium">Status:</span> {o.status ?? 'idea'}</p>
            {o.notes ? <p className="mt-1">{o.notes}</p> : null}
            <div className="mt-3">
              <span className="text-xs uppercase tracking-widest text-slate-500">Change status</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {['idea', 'scouted', 'go', 'no-go', 'done'].map((s) => (
                  <Button key={s} size="sm" variant={o.status === s ? 'default' : 'ghost'} disabled={!canEdit || busy !== null} onClick={() => run('Saving…', async () => { await outingMut.putConfirmed(outingId, { status: s }) })}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            {outing.createdBy === userId || canScout ? <div className="mt-4">
              <Button variant="outline" disabled={!canEdit || busy !== null} onClick={() => {
                if (!confirmDelete) { setConfirmDelete(true); return }
                run('Deleting outing…', async () => { await callAction('deleteOuting', { outingId }); navigate('/home'); success('Outing deleted') })
              }}>{confirmDelete ? 'Confirm delete outing' : 'Delete outing'}</Button>
            </div> : null}
            <Textarea
              className="mt-3"
              key={o.notes}
              disabled={!canEdit}
              maxLength={2000}
              defaultValue={o.notes ?? ''}
              placeholder="Edit crew notes…"
              aria-label="Edit notes"
              onBlur={(e) => {
                if (e.target.value !== (o.notes ?? '')) outingMut.putConfirmed(outingId, { notes: e.target.value }).catch(() => error('Save failed', 'Try again.'))
              }}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
