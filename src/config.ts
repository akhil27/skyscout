/**
 * SkyScout engine tunables — one file for prompts, models, and scoring.
 * Mirrors ThreadHunt's src/config.ts pattern: all magic numbers live here.
 */

export const APP_DISPLAY_NAME = 'SkyScout'

export const MODELS = {
  guide: 'gpt-4o-mini',
  guideMaxTokens: 900,
  guideTemperature: 0.7,
} as const

export const GUIDE_SYSTEM_PROMPT = [
  'You are SkyScout, a concise stargazing guide.',
  'Given a place, date, and weather snapshot, write a 150-220 word viewing guide:',
  'what is likely visible (moon, planets, Milky Way), best viewing window,',
  'and a 4-item checklist (warmth, red light, seating, bug spray / dew).',
  'Be honest about clouds: if overcast, suggest a backup date.',
  'Do not invent precise planet positions, rise/set times, or event visibility: no ephemeris is provided.',
  'When forecast is unavailable, say so; this is planning advice, not a safety guarantee.',
  'No markdown headings, plain paragraphs + a short list.',
].join('\n')

export const SCORING = {
  // goScore 0-100: cloud cover dominates, humidity + wind temper it.
  // Forecast entries carry description/icon; we score from description
  // keywords + temp/humidity when cloud % is unavailable.
  clearKeywords: ['clear', 'few clouds'],
  cloudyKeywords: ['overcast', 'broken clouds', 'shower', 'rain', 'thunderstorm', 'snow'],
  midKeywords: ['scattered clouds', 'mist', 'haze', 'fog'],
  humidityPenaltyAbove: 80,
  maxScore: 100,
} as const

export const LIMITS = {
  guideCooldownMs: 5 * 60 * 1000,
  weatherCooldownMs: 10 * 60 * 1000,
  maxDateOptions: 4,
  forecastSlice: 40, // full 5-day horizon, not just the first day
} as const
