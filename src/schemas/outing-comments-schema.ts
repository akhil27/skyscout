import type { CollectionSchema } from 'deepspace/schema'

/**
 * Outing-scoped discussion. Deliberately separate from the global
 * messaging channels: these rows are scoped by outingId and filtered
 * server-side via `where`, so a group plans without a public lobby.
 */
export const outingCommentsSchema: CollectionSchema = {
  name: 'outing_comments',
  columns: [
    { name: 'outingId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'body', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
