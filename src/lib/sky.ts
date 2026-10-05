import { SCORING } from '../config'

export interface ForecastEntry {
  dt: number
  temp: number
  feels_like?: number
  humidity?: number
  description?: string
  icon?: string
}

export interface GoScoreBreakdown {
  score?: number
  label: 'Go' | 'Maybe' | 'No-go' | 'Unavailable'
  reason: string
}

/** Shared approximate lunar context, not a location-specific ephemeris. */
export function moonContext(date: Date): { illumination: number; phase: string } {
  const synodic = 29.53058867
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000
  const days = date.getTime() / 86400000 - ref
  const age = ((days % synodic) + synodic) % synodic
  const illumination = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2
  const waxing = age < synodic / 2
  const phase = !Number.isFinite(illumination) ? 'unavailable'
    : illumination < 0.01 ? 'new moon'
      : illumination > 0.99 ? 'full moon'
        : Math.abs(illumination - 0.5) < 0.02 ? (waxing ? 'first quarter' : 'last quarter')
          : `${waxing ? 'waxing' : 'waning'} ${illumination < 0.5 ? 'crescent' : 'gibbous'}`
  return { illumination, phase }
}

/** Approximate illumination 0..1; preserves the existing scoring calculation. */
export function moonIllumination(date: Date): number {
  return moonContext(date).illumination
}

/** Reject explicit contradictory lunar claims; do not rewrite model prose or invent facts. */
export function guideMatchesMoon(text: string, moon: ReturnType<typeof moonContext>): boolean {
  const claims = text.toLowerCase().match(/\b(?:waxing|waning)(?:\s+(?:crescent|gibbous))?\b|\b(?:new|full) moon\b|\b(?:first|last|third) quarter\b/g) ?? []
  const phase = moon.phase.replace('last quarter', 'third quarter')
  return claims.every((claim) => {
    const normalized = claim.replace('last quarter', 'third quarter')
    return normalized === phase || ((normalized === 'waxing' || normalized === 'waning') && phase.startsWith(normalized))
  })
}

function descScore(description: string): number {
  const d = description.toLowerCase()
  if (SCORING.cloudyKeywords.some((k) => d.includes(k))) return 15
  if (SCORING.midKeywords.some((k) => d.includes(k))) return 55
  if (SCORING.clearKeywords.some((k) => d.includes(k))) return 92
  if (d.includes('cloud')) return 45
  return 65
}

/**
 * Compute a 0-100 go/no-go score from forecast entries + moon.
 * Pure + unit-tested: no network, no DeepSpace imports.
 */
export function computeGoScore(entries: ForecastEntry[], dateISO: string): GoScoreBreakdown {
  if (!entries.length) return { label: 'Unavailable', reason: 'No forecast data yet.' }
  const target = new Date(dateISO).getTime()
  if (!Number.isFinite(target)) return { label: 'Unavailable', reason: 'Invalid outing date.' }
  const usable = entries.filter((e) => Number.isFinite(e.dt) && Math.abs(e.dt * 1000 - target) <= 6 * 3600000)
  if (!usable.length) return { label: 'Unavailable', reason: 'This night is outside the available five-day forecast. Check closer to the date.' }
  const sorted = [...usable].sort(
    (a, b) => Math.abs(a.dt * 1000 - target) - Math.abs(b.dt * 1000 - target),
  )
  const near = sorted.slice(0, 3)
  const base = near.reduce((s, e) => s + descScore(e.description ?? ''), 0) / near.length
  const humid = near.reduce((s, e) => s + (e.humidity ?? 50), 0) / near.length
  const humidityPenalty = humid > SCORING.humidityPenaltyAbove ? (humid - 80) * 0.8 : 0
  const moon = moonIllumination(new Date(dateISO))
  const moonPenalty = moon > 0.8 ? 8 : moon > 0.5 ? 4 : 0
  const score = Math.max(0, Math.min(100, Math.round(base - humidityPenalty - moonPenalty)))
  const label = score >= 70 ? 'Go' : score >= 45 ? 'Maybe' : 'No-go'
  const main = near[0]?.description ?? 'unknown'
  const reason =
    label === 'Go'
      ? `Skies look ${main}; moon ${(moon * 100).toFixed(0)}% — good to go.`
      : label === 'Maybe'
        ? `Skies look ${main}; marginal — bring backup plans.`
        : `Skies look ${main}; better to pick another night.`
  return { score, label, reason }
}

/** Reject malformed upstream rows rather than creating a plausible score from zeros. */
export function normalizeForecast(data: unknown): ForecastEntry[] {
  if (!Array.isArray(data)) return []
  return data.filter((e): e is ForecastEntry => !!e && typeof e === 'object' &&
    typeof e.dt === 'number' && Number.isFinite(e.dt) && e.dt > 0 &&
    typeof e.temp === 'number' && Number.isFinite(e.temp) &&
    typeof e.description === 'string' && e.description.length > 0)
}

/** Strict date inputs; dates are interpreted at 9pm in the organizer's browser timezone. */
export function parseDateOptions(value: string): string[] {
  const values = value.split(',').map((s) => s.trim())
  if (values.length < 2 || values.length > 4) throw new Error('Choose 2–4 nights, comma-separated.')
  return [...new Set(values.map((s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Use YYYY-MM-DD for every night.')
    const d = new Date(`${s}T21:00:00`)
    if (!Number.isFinite(d.getTime()) || d.getFullYear() !== Number(s.slice(0, 4)) || d.getMonth() + 1 !== Number(s.slice(5, 7)) || d.getDate() !== Number(s.slice(8, 10))) throw new Error('One of the dates is invalid.')
    if (d.getTime() < Date.now()) throw new Error('Choose upcoming nights.')
    return d.toISOString()
  }))]
}

export function formatScoreDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
