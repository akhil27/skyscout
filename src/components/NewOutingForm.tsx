import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthProfileReady, useMutations } from 'deepspace'
import { Button, Input, Textarea, useToast } from '@/components/ui'
import { callAction } from '@/lib/callAction'
import { parseDateOptions } from '@/lib/sky'
import type { Outing } from '@/types'

interface Place { name: string; lat: number; lon: number; state?: string; country?: string }
const placeLabel = (p: Place) => [p.name, p.state, p.country].filter(Boolean).join(', ')

export function NewOutingForm() {
  const { createConfirmed, ready } = useMutations<Outing>('outings')
  const { user } = useAuthProfileReady({ requireUser: true })
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [candidates, setCandidates] = useState<Place[]>([])
  const [selected, setSelected] = useState<Place | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [dates, setDates] = useState(() => [2, 4].map((n) => {
    const d = new Date(); d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }).join(', '))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function lookup() {
    setBusy(true)
    try {
      const result = await callAction<Place[]>('geocodePlace', { place })
      if (!Array.isArray(result)) throw new Error('Unexpected place response.')
      const valid = result.filter((p) => typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      setCandidates(valid); setLookupDone(true); setSelected(valid.length === 1 ? valid[0] : null)
    } catch (e) { error('Place lookup failed', e instanceof Error ? e.message : 'Try again.') }
    finally { setBusy(false) }
  }

  async function submit() {
    if (!title.trim() || !place.trim()) { error('Missing details', 'Add a title and a city/state/country.'); return }
    let dateOptions: string[]
    try { dateOptions = parseDateOptions(dates) } catch (e) { error('Bad dates', (e as Error).message); return }
    if (dateOptions.length < 2) { error('Bad dates', 'Choose at least two distinct nights.'); return }
    setBusy(true)
    try {
      const id = await createConfirmed({ title: title.trim(), placeName: selected ? placeLabel(selected) : place.trim(), lat: selected?.lat, lng: selected?.lon,
        dateOptions, chosenDate: dateOptions[0], notes: notes.trim(), status: 'idea' })
      success('Outing created', 'Refresh weather to check your selected night.')
      navigate(`/outings/${id}`)
    } catch (e) { error('Could not create outing', e instanceof Error ? e.message : 'Try again.') }
    finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="font-semibold">New stargazing outing</h2>
      <p className="mt-1 text-sm text-slate-400">A spot, 2–4 nights, and your crew votes. Organizer runs paid sky checks.</p>
      <div className="mt-4 grid gap-3">
        <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Perseids at the lake cabin" aria-label="Outing title" />
        <div className="flex gap-2">
          <Input value={place} maxLength={200} onChange={(e) => { setPlace(e.target.value); setSelected(null); setCandidates([]); setLookupDone(false) }} placeholder="Place — e.g. Joshua Tree, CA" aria-label="Place" />
          <Button variant="outline" disabled={!ready || busy || !place.trim() || user?.role !== 'admin'} onClick={lookup}>Find place</Button>
        </div>
        {!selected ? <p className="text-xs text-slate-400">You can save a city/state/country directly. Organizer-only lookup helps disambiguate places; coordinates are optional.</p> : null}
        {candidates.map((p, i) => <Button key={i} variant={selected === p ? 'default' : 'outline'} onClick={() => setSelected(p)}>{placeLabel(p)}</Button>)}
        {lookupDone && !candidates.length ? <p className="text-sm text-slate-400">No matches. Try a nearby city with its country.</p> : null}
        <Input value={dates} onChange={(e) => setDates(e.target.value)} placeholder="YYYY-MM-DD, YYYY-MM-DD" aria-label="Date options" />
        <p className="text-xs text-slate-500">9pm in your browser timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Weather covers the next five days; distant nights stay unavailable.</p>
        <Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Telescope, snacks, parking — optional" aria-label="Notes" />
        <Button disabled={!ready || busy || !title.trim() || !place.trim()} onClick={submit}>{busy ? 'Working…' : 'Create outing'}</Button>
      </div>
    </section>
  )
}
