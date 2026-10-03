import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import type { Outing } from './types'
import type { RecordData } from 'deepspace'
import { computeGoScore, normalizeForecast } from './lib/sky'

export const tasks: CronTask[] = [{ name: 'nightly-refresh', schedule: '0 4 * * *', timezone: 'America/New_York' }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== 'nightly-refresh') return
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const rows = await ctx.records.query('outings', { limit: 100 }) as RecordData<Outing>[]
  // Bound overnight spend to 20 forecasts. Completed/cancelled outings never refresh.
  let calls = 0
  for (const row of rows) {
    const date = row.data.chosenDate ?? row.data.dateOptions?.[0]
    if (!date || ['done', 'no-go'].includes(row.data.status ?? '')) continue
    const t = Date.parse(date)
    if (!Number.isFinite(t) || t < Date.now() || t > Date.now() + 5 * 86400000) continue
    if (calls++ >= 20) break
    try {
      // CronContext unwraps the integration envelope and throws on failure.
      const data = await ctx.integrations.call('openweathermap/forecast', { q: row.data.placeName, units: 'metric' })
      const entries = normalizeForecast(data)
      if (!entries.length) throw new Error('Empty forecast.')
      await ctx.records.update('outings', row.recordId, { weatherCache: entries, weatherAt: new Date().toISOString(), goScore: computeGoScore(entries, date).score ?? null })
    } catch (e) {
      console.warn(`[nightly-refresh] outing=${row.recordId}: ${e instanceof Error ? e.message : 'Refresh failed'}`)
    }
  }
  // Remove expired spend reservations in bounded pages; cached APOD records are retained.
  const settings = await ctx.records.query('settings', { limit: 500 }) as RecordData<{ key: string }>[]
  for (const row of settings) {
    if (row.data.key.startsWith('spend:') && Date.parse(row.createdAt) < Date.now() - 86400000) await ctx.records.delete('settings', row.recordId)
  }
}
