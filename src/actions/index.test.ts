import { describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { actions } from './index'
import { votesSchema } from '../schemas/votes-schema'

function context(overrides: Partial<ActionContext<Env>> = {}) {
  const tools = {
    get: vi.fn().mockResolvedValue({ success: true, data: { record: { data: {
      title: 'Night out', placeName: 'Joshua Tree, CA, US',
      chosenDate: new Date().toISOString(), email: 'owner@example.com',
    } } } }),
    create: vi.fn().mockResolvedValue({ success: true, data: { recordId: 'reservation' } }),
    update: vi.fn().mockResolvedValue({ success: true, data: { recordId: 'outing' } }),
    integration: vi.fn().mockResolvedValue({ success: true, data: [{ dt: Date.now() / 1000, temp: 12, description: 'clear sky' }] }),
  }
  return { tools, ctx: {
    userId: 'organizer', env: { OWNER_USER_ID: 'organizer' } as Env,
    params: { outingId: 'outing' }, callerJwt: '', tools: tools as unknown as ActionTools, ...overrides,
  } }
}

describe('paid action boundaries', () => {
  it.each(['geocodePlace', 'refreshWeather', 'generateGuide', 'sendReminder'])('%s never spends for another account', async (name) => {
    const { ctx, tools } = context({ userId: 'member' })
    expect(await actions[name](ctx)).toMatchObject({ success: false, error: expect.stringContaining('organizer') })
    expect(tools.integration).not.toHaveBeenCalled()
  })
  it('fails closed without an owner identity', async () => {
    const { ctx, tools } = context({ env: {} as Env })
    expect((await actions.refreshWeather(ctx)).success).toBe(false)
    expect(tools.integration).not.toHaveBeenCalled()
  })
  it('honors the weather cooldown before an upstream call', async () => {
    const { ctx, tools } = context()
    tools.get.mockResolvedValue({ success: true, data: { record: { data: { weatherAt: new Date().toISOString() } } } })
    expect(await actions.refreshWeather(ctx)).toMatchObject({ success: false, error: expect.stringContaining('fresh') })
    expect(tools.integration).not.toHaveBeenCalled()
  })
  it('a refused atomic spend reservation prevents a paid call', async () => {
    const { ctx, tools } = context()
    tools.create.mockResolvedValue({ success: false, error: 'Duplicate key' })
    expect((await actions.refreshWeather(ctx)).success).toBe(false)
    expect(tools.integration).not.toHaveBeenCalled()
  })
  it('does not announce success if saving the forecast fails', async () => {
    const { ctx, tools } = context()
    tools.update.mockResolvedValue({ success: false, error: 'Storage full' })
    expect(await actions.refreshWeather(ctx)).toEqual({ success: false, error: 'Storage full' })
  })
  it('does not turn an empty forecast into a zero score', async () => {
    const { ctx, tools } = context()
    tools.integration.mockResolvedValue({ success: true, data: [] })
    expect(await actions.refreshWeather(ctx)).toMatchObject({ success: false, error: expect.stringContaining('No forecast') })
    expect(tools.update).not.toHaveBeenCalled()
  })
  it('propagates integration errors unchanged', async () => {
    const { ctx, tools } = context()
    tools.integration.mockResolvedValue({ success: false, error: 'Insufficient credits' })
    expect(await actions.refreshWeather(ctx)).toEqual({ success: false, error: 'Insufficient credits' })
  })
  it('an email recipient always comes from the verified caller row, not params', async () => {
    const { ctx, tools } = context({ params: { outingId: 'outing', to: 'attacker@example.com' } })
    await actions.sendReminder(ctx)
    expect(tools.integration).toHaveBeenCalledWith('email/send', expect.objectContaining({ to: 'owner@example.com' }))
    expect(tools.get).toHaveBeenCalledWith('users', 'organizer')
  })
  it('serves cached NASA data to members without spending', async () => {
    const { ctx, tools } = context({ userId: 'member' })
    tools.get.mockResolvedValue({ success: true, data: { record: { data: { value: JSON.stringify({ title: 'Orion' }) } } } })
    expect(await actions.getApod(ctx)).toEqual({ success: true, data: { title: 'Orion' } })
    expect(tools.integration).not.toHaveBeenCalled()
  })
})

describe('outing deletion authorization', () => {
  it('does not cascade for a caller who neither owns the outing nor the app', async () => {
    const { ctx, tools } = context({ userId: 'intruder' })
    tools.get.mockResolvedValue({ success: true, data: { record: { createdBy: 'creator', data: {} } } })
    expect(await actions.deleteOuting(ctx)).toMatchObject({ success: false, error: expect.stringContaining('creator') })
    expect(tools.update).not.toHaveBeenCalled()
  })
})

describe('vote schema contract', () => {
  it('uses platform-bound immutable identity and server-side composite uniqueness', () => {
    expect(votesSchema.uniqueOn).toEqual(['outingId', 'option', 'userId'])
    expect(votesSchema.ownerField).toBe('userId')
    expect(votesSchema.columns.find((c) => c.name === 'userId')).toMatchObject({ userBound: true, immutable: true })
    expect(votesSchema.permissions.member.update).toBe('own')
  })
})
