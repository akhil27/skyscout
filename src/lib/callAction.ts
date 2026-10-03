import { getAuthToken } from 'deepspace'

/**
 * Call a server action (POST /api/actions/:name) with the caller's JWT.
 * Server actions are the only path to paid integrations from the client —
 * they enforce auth, cooldowns, and owner-billing in one place.
 */
export async function callAction<T = unknown>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: T
    error?: string
  }
  if (!res.ok || body.success === false) throw new Error(body.error ?? `Action ${name} failed.`)
  return body.data as T
}
