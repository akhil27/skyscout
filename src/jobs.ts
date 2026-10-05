import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { actions } from './actions'
import { createActionTools } from './server/action-routes'
import type { ScoutResult } from './lib/scout'

/** One queue, the same authorization, spending limits, and data contract as actions. */
export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<ScoutResult> {
  if (job.type !== 'scout-outing') throw new Error(`Unknown job type: ${job.type}`)
  if (!env.OWNER_USER_ID || job.enqueuedBy !== env.OWNER_USER_ID) throw new Error('Only the organizer can scout.')
  const payload = job.payload as { outingId?: unknown } | null
  if (typeof payload?.outingId !== 'string') throw new Error('Missing outingId.')
  const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(120_000)])
  const context = { userId: env.OWNER_USER_ID, params: { outingId: payload.outingId }, env,
    callerJwt: env.APP_OWNER_JWT, tools: createActionTools(env, env.OWNER_USER_ID, env.APP_OWNER_JWT, signal) }
  signal.throwIfAborted()
  ctx.progress(0.1, 'Checking forecast…')
  const existing = await context.tools.get<{ weatherAt?: string }>('outings', payload.outingId)
  if (!existing.success) throw new Error(existing.error)
  const fresh = existing.data.record.data.weatherAt
  if (!fresh || Date.now() - Date.parse(fresh) >= 600_000) {
    const weather = await actions.refreshWeather(context)
    if (!weather.success) throw new Error(weather.error)
  }
  signal.throwIfAborted()
  ctx.progress(0.6, 'Writing viewing guide…')
  const guide = await actions.generateGuide(context)
  if (!guide.success) {
    signal.throwIfAborted()
    if (guide.code === 'guide_cooldown') {
      // JobRoom has no blocked state: persist a handled request outcome, not
      // an exception/retry or a claim that a new guide was generated.
      ctx.progress(1, guide.error)
      return { outingId: payload.outingId, outcome: 'cooldown', message: guide.error }
    }
    throw new Error(guide.error)
  }
  signal.throwIfAborted()
  ctx.progress(1, 'Scout complete.')
  return { outingId: payload.outingId, outcome: 'complete' }
}
