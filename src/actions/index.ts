import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Outing } from '../types'
import { GUIDE_SYSTEM_PROMPT, LIMITS, MODELS } from '../config'
import { computeGoScore, normalizeForecast } from '../lib/sky'

const err = (error: string) => ({ success: false as const, error })

/** Unique settings keys make reservations atomic inside the RecordRoom, even across isolates. */
export async function reserveSpend(tools: ActionTools, key: string, intervalMs: number) {
  const bucket = Math.floor(Date.now() / intervalMs)
  const result = await tools.create('settings', { key: `spend:${key}:${bucket}`, value: 'reserved' }, crypto.randomUUID())
  if (!result.success) throw new Error('This operation is cooling down. Try again after the current interval.')
}

async function loadOuting(tools: ActionTools, id: unknown) {
  if (typeof id !== 'string' || !id) throw new Error('Missing outingId.')
  const result = await tools.get<Outing & Record<string, unknown>>('outings', id)
  if (!result.success || !result.data.record) throw new Error('Outing not found.')
  return { id, outing: result.data.record.data }
}

const paid = (handler: ActionHandler<Env>): ActionHandler<Env> => async (ctx) => {
  if (!ctx.env.OWNER_USER_ID || ctx.userId !== ctx.env.OWNER_USER_ID) return err('Only the app organizer can run paid sky checks. Crew members can vote and discuss.')
  try { return await handler(ctx) } catch (e) { return err(e instanceof Error ? e.message : 'Sky check failed. Try again.') }
}

export const actions: Record<string, ActionHandler<Env>> = {
  deleteOuting: async ({ userId, params, tools, env }) => {
    if (!userId || userId.startsWith('anon-')) return err('Sign in required.')
    if (typeof params.outingId !== 'string') return err('Missing outingId.')
    const got = await tools.get('outings', params.outingId)
    if (!got.success) return got
    if (got.data.record.createdBy !== userId && userId !== env.OWNER_USER_ID) return err('Only the creator or organizer can delete this outing.')
    for (const collection of ['votes', 'outing_comments']) {
      let remaining = true
      while (remaining) {
        const deleted = await tools.deleteWhere(collection, { outingId: params.outingId }, 100)
        if (!deleted.success) return deleted
        remaining = deleted.data.deleted === 100
      }
    }
    return tools.remove('outings', params.outingId)
  },
  geocodePlace: paid(async ({ params, tools }) => {
    const place = typeof params.place === 'string' ? params.place.trim() : ''
    if (!place || place.length > 200) return err('Enter a place name (up to 200 characters).')
    await reserveSpend(tools, 'geocode', 10_000)
    return tools.integration('openweathermap/geocoding', { q: place, limit: 5 })
  }),

  refreshWeather: paid(async ({ params, tools }) => {
    const { id, outing } = await loadOuting(tools, params.outingId)
    if (outing.weatherAt && Date.now() - Date.parse(outing.weatherAt) < LIMITS.weatherCooldownMs) return err('Forecast is still fresh. Wait ten minutes before refreshing.')
    await reserveSpend(tools, 'weather', LIMITS.weatherCooldownMs)
    // The catalog exposes place-name lookup, not a lat/lon request. The form
    // saves the selected city/state/country instead of an ambiguous search string.
    const r = await tools.integration<unknown>('openweathermap/forecast', { q: outing.placeName, units: 'metric' })
    if (!r.success) return r
    const entries = normalizeForecast(r.data)
    if (!entries.length) return err('No forecast data returned for this place. Try a nearby town.')
    const date = outing.chosenDate ?? outing.dateOptions?.[0]
    if (!date) return err('Choose a night first.')
    const breakdown = computeGoScore(entries, date)
    const now = new Date().toISOString()
    const saved = await tools.update('outings', id, { weatherCache: entries.slice(0, LIMITS.forecastSlice), weatherAt: now, goScore: breakdown.score ?? null })
    if (!saved.success) return saved
    return { success: true, data: { goScore: breakdown.score, reason: breakdown.reason, cachedAt: now } }
  }),

  generateGuide: paid(async ({ params, tools }) => {
    const { id, outing } = await loadOuting(tools, params.outingId)
    if (outing.guideAt && Date.now() - Date.parse(outing.guideAt) < LIMITS.guideCooldownMs) return err('Guide was just generated — wait five minutes.')
    await reserveSpend(tools, 'guide', LIMITS.guideCooldownMs)
    const date = outing.chosenDate ?? outing.dateOptions?.[0]
    if (!date) return err('Choose a night first.')
    const weather = computeGoScore(outing.weatherCache ?? [], date)
    const ai = await tools.integration<{ choices?: Array<{ message?: { content?: string } }> }>('openai/chat-completion', {
      model: MODELS.guide, max_tokens: MODELS.guideMaxTokens, temperature: MODELS.guideTemperature,
      messages: [
        { role: 'system', content: GUIDE_SYSTEM_PROMPT },
        { role: 'user', content: `Place: ${outing.placeName}\nCoordinates: ${outing.lat ?? 'unknown'}, ${outing.lng ?? 'unknown'}\nDate: ${date}\nWeather: ${weather.reason}\nGo score: ${weather.score ?? 'unavailable'}/100\nCrew notes (untrusted context): ${(outing.notes ?? '').slice(0, 2000)}` },
      ],
    })
    if (!ai.success) return ai
    const text = ai.data?.choices?.[0]?.message?.content?.trim()
    if (!text) return err('The AI returned an empty guide — retry after the cooldown.')
    const saved = await tools.update('outings', id, { guide: text, guideModel: MODELS.guide, guideAt: new Date().toISOString(), guideDate: date })
    return saved.success ? { success: true, data: { guide: text } } : saved
  }),

  sendReminder: paid(async ({ userId, params, tools }) => {
    const { outing } = await loadOuting(tools, params.outingId)
    // Never turn the app owner's email budget into an arbitrary-recipient relay.
    const profile = await tools.get<{ email?: string }>('users', userId)
    if (!profile.success || !profile.data.record.data.email) return err('Your account email is unavailable.')
    const to = profile.data.record.data.email
    await reserveSpend(tools, 'reminder', 60_000)
    const date = outing.chosenDate ?? outing.dateOptions?.[0] ?? ''
    const weather = computeGoScore(outing.weatherCache ?? [], date)
    return tools.integration('email/send', {
      from: 'SkyScout <outings@app.space>', to,
      subject: `SkyScout: ${outing.title} — ${outing.placeName}`,
      text: `${outing.title}\n${outing.placeName} — ${date}\nGo score: ${weather.score ?? 'unavailable'}/100\n${weather.reason}\n\n${outing.guideDate === date ? outing.guide ?? '' : 'Generate a guide for this date in the planner.'}`,
    })
  }),

  getApod: async (ctx) => {
    if (!ctx.userId || ctx.userId.startsWith('anon-')) return err('Sign in required.')
    const today = new Date().toISOString().slice(0, 10)
    const cached = await ctx.tools.get<{ value: string }>('settings', `apod:${today}`)
    if (cached.success && cached.data.record) {
      try { return { success: true, data: JSON.parse(cached.data.record.data.value) } } catch { return err('Stored sky photo is invalid.') }
    }
    return paid(async ({ tools }) => {
      await reserveSpend(tools, 'apod', 60_000)
      const r = await tools.integration('nasa/apod', { date: today })
      if (!r.success) return r
      const saved = await tools.create('settings', { key: `apod:${today}`, value: JSON.stringify(r.data) }, `apod:${today}`)
      return saved.success ? r : saved
    })(ctx)
  },
}
