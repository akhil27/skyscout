import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { runJob } from './jobs'
import { actions } from './actions'
import { createActionTools } from './server/action-routes'
import { GUIDE_COOLDOWN_MESSAGE, scoutStatusText } from './lib/scout'

vi.mock('./server/action-routes', () => ({ createActionTools: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

function fixture() {
  const tools = { get: vi.fn().mockResolvedValue({ success: true, data: { record: { data: { weatherAt: new Date().toISOString() } } } }) }
  vi.mocked(createActionTools).mockReturnValue(tools as unknown as ReturnType<typeof createActionTools>)
  const ctx: JobContext = { signal: new AbortController().signal, progress: vi.fn(), continue: vi.fn() }
  const job: Job = { id: 'job', type: 'scout-outing', status: 'running', payload: { outingId: 'outing' }, enqueuedBy: 'organizer', attempts: 1, maxAttempts: 1, enqueuedAt: new Date().toISOString() }
  const env = { OWNER_USER_ID: 'organizer', APP_OWNER_JWT: '' } as Env
  return { tools, ctx, job, env }
}

describe('Full Scout outcomes', () => {
  it('returns a distinct cooldown outcome without claiming a new guide', async () => {
    const { ctx, job, env } = fixture()
    vi.spyOn(actions, 'generateGuide').mockResolvedValue({ success: false, code: 'guide_cooldown', error: GUIDE_COOLDOWN_MESSAGE })
    const weather = vi.spyOn(actions, 'refreshWeather')
    const result = await runJob(job, ctx, env)
    expect(result).toEqual({ outingId: 'outing', outcome: 'cooldown', message: GUIDE_COOLDOWN_MESSAGE })
    expect(scoutStatusText({ status: 'succeeded', result })).toBe(`Full scout: ${GUIDE_COOLDOWN_MESSAGE}`)
    expect(weather).not.toHaveBeenCalled()
    expect(ctx.progress).not.toHaveBeenCalledWith(1, 'Scout complete.')
  })

  it('refreshes stale weather and completes when guide generation is allowed', async () => {
    const { tools, ctx, job, env } = fixture()
    tools.get.mockResolvedValue({ success: true, data: { record: { data: {} } } })
    const weather = vi.spyOn(actions, 'refreshWeather').mockResolvedValue({ success: true, data: {} })
    const guide = vi.spyOn(actions, 'generateGuide').mockResolvedValue({ success: true, data: { guide: 'Guide' } })
    expect(await runJob(job, ctx, env)).toEqual({ outingId: 'outing', outcome: 'complete' })
    expect(weather).toHaveBeenCalledOnce()
    expect(guide).toHaveBeenCalledOnce()
    expect(ctx.progress).toHaveBeenLastCalledWith(1, 'Scout complete.')
  })

  it('throws genuine guide failures even if their message mentions cooldown', async () => {
    const { ctx, job, env } = fixture()
    vi.spyOn(actions, 'generateGuide').mockResolvedValue({ success: false, error: 'Provider failed during cooldown' })
    await expect(runJob(job, ctx, env)).rejects.toThrow('Provider failed during cooldown')
    expect(scoutStatusText({ status: 'failed', error: 'Provider failed during cooldown' })).toBe('Full scout: failed — Provider failed during cooldown')
  })

  it('throws real weather and record failures', async () => {
    const { tools, ctx, job, env } = fixture()
    tools.get.mockResolvedValue({ success: false, error: 'Record unavailable' })
    await expect(runJob(job, ctx, env)).rejects.toThrow('Record unavailable')
    tools.get.mockResolvedValue({ success: true, data: { record: { data: {} } } })
    vi.spyOn(actions, 'refreshWeather').mockResolvedValue({ success: false, error: 'Weather provider unavailable' })
    await expect(runJob(job, ctx, env)).rejects.toThrow('Weather provider unavailable')
  })

  it('preserves job authorization, payload validation, and cancellation', async () => {
    const { ctx, job, env } = fixture()
    await expect(runJob({ ...job, enqueuedBy: 'member' }, ctx, env)).rejects.toThrow('organizer')
    await expect(runJob({ ...job, type: 'unknown' }, ctx, env)).rejects.toThrow('Unknown job')
    await expect(runJob({ ...job, payload: {} }, ctx, env)).rejects.toThrow('Missing outingId')
    const guide = vi.spyOn(actions, 'generateGuide')
    await expect(runJob(job, { ...ctx, signal: AbortSignal.abort(new Error('Canceled')) }, env)).rejects.toThrow('Canceled')
    expect(guide).not.toHaveBeenCalled()
  })

  it('presents only the exact legacy cooldown as cooldown, retaining all other terminal states', () => {
    expect(scoutStatusText({ status: 'failed', error: 'Guide was just generated — wait five minutes.' })).toBe(`Full scout: ${GUIDE_COOLDOWN_MESSAGE}`)
    expect(scoutStatusText({ status: 'failed', error: 'Insufficient credits' })).toBe('Full scout: failed — Insufficient credits')
    expect(scoutStatusText({ status: 'canceled' })).toBe('Full scout: canceled')
    expect(scoutStatusText({ status: 'succeeded' })).toBe('Full scout: succeeded')
    expect(scoutStatusText({ status: 'running', progressMessage: 'Checking forecast…' })).toBe('Full scout: running — Checking forecast…')
  })
})
