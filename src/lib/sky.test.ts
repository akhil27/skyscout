import { describe, expect, it } from 'vitest'
import { computeGoScore, moonIllumination, normalizeForecast, parseDateOptions } from './sky'

describe('computeGoScore', () => {
  it('scores clear skies as Go', () => {
    const r = computeGoScore(
      [{ dt: Date.now() / 1000, temp: 12, humidity: 40, description: 'clear sky' }],
      new Date().toISOString(),
    )
    expect(r.label).toBe('Go')
    expect(r.score).toBeGreaterThanOrEqual(70)
  })

  it('scores overcast as No-go', () => {
    const r = computeGoScore(
      [{ dt: Date.now() / 1000, temp: 12, humidity: 90, description: 'overcast clouds' }],
      new Date().toISOString(),
    )
    expect(r.label).toBe('No-go')
  })

  it('handles empty forecast', () => {
    const r = computeGoScore([], new Date().toISOString())
    expect(r.score).toBeUndefined()
    expect(r.label).toBe('Unavailable')
  })
})

describe('forecast and date validation', () => {
  it('never scores a night outside the real forecast horizon', () => {
    const r = computeGoScore([{ dt: Date.parse('2026-10-03T21:00:00Z') / 1000, temp: 12, description: 'clear sky' }], '2026-10-10T21:00:00Z')
    expect(r.score).toBeUndefined()
    expect(r.reason).toContain('outside')
  })
  it('rejects invalid target dates', () => {
    expect(computeGoScore([{ dt: 1, temp: 12 }], 'bad').label).toBe('Unavailable')
  })
  it('filters malformed upstream responses', () => {
    expect(normalizeForecast({ list: [] })).toEqual([])
    expect(normalizeForecast([{ dt: 0, temp: 0 }, { dt: 10, temp: 12, description: 'clear sky' }])).toHaveLength(1)
  })
  it('rejects malformed or overflowing dates rather than silently dropping them', () => {
    expect(() => parseDateOptions('2030-02-31, 2030-03-02')).toThrow('invalid')
    expect(() => parseDateOptions('bad, 2030-03-02')).toThrow('YYYY-MM-DD')
    expect(() => parseDateOptions('2030-03-02')).toThrow('2–4')
  })
  it('parses upcoming nights as explicit instants', () => {
    expect(parseDateOptions('2030-03-02, 2030-03-03')).toHaveLength(2)
  })
})

describe('moonIllumination', () => {
  it('stays in 0..1', () => {
    for (const d of ['2026-01-01', '2026-06-15', '2026-10-03']) {
      const m = moonIllumination(new Date(d))
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
    }
  })
})
