import type { JobView } from 'deepspace'

export const GUIDE_COOLDOWN_MESSAGE = 'Guide generation is on cooldown. Try again in a few minutes.'

export interface ScoutResult {
  outingId: string
  outcome: 'complete' | 'cooldown'
  message?: string
}

export function scoutStatusText(job: Pick<JobView<unknown, ScoutResult>, 'status' | 'result' | 'error' | 'progressMessage'>): string {
  if (job.status === 'succeeded' && job.result?.outcome === 'cooldown') {
    return `Full scout: ${job.result.message ?? GUIDE_COOLDOWN_MESSAGE}`
  }
  // Previously persisted jobs have only this exact app-defined error string.
  if (job.status === 'failed' && job.error === 'Guide was just generated — wait five minutes.') {
    return `Full scout: ${GUIDE_COOLDOWN_MESSAGE}`
  }
  return `Full scout: ${job.status}${job.error ? ` — ${job.error}` : ''}${job.status === 'running' && job.progressMessage ? ` — ${job.progressMessage}` : ''}`
}
