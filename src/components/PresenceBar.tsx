import { usePresenceRoom } from 'deepspace'

/** Who else is scouting this outing right now. Ephemeral, per-outing scope. */
export function PresenceBar({ outingId }: { outingId: string }) {
  const { peers, connected } = usePresenceRoom(`outing:${outingId}`)
  if (!connected) return <span className="text-xs text-slate-500">Connecting presence…</span>
  if (peers.length === 0) return <span className="text-xs text-slate-500">Just you here — share the link to plan together.</span>
  return (
    <span className="text-xs text-slate-400">
      👀 {peers.length} scout{peers.length === 1 ? '' : 's'} here: {peers.slice(0, 3).map((p) => p.userName).join(', ')}
      {peers.length > 3 ? ` +${peers.length - 3}` : ''}
    </span>
  )
}
