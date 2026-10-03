import type { CollectionSchema } from 'deepspace/schema'

/**
 * Per-date votes. The DO binds identity and enforces composite uniqueness.
 * choice: 'go' | 'maybe' | 'no'
 */
export const votesSchema: CollectionSchema = {
  name: 'votes',
  uniqueOn: ['outingId', 'option', 'userId'],
  ownerField: 'userId',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'outingId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'option', storage: 'text', interpretation: 'plain', required: true },
    { name: 'choice', storage: 'text', interpretation: { kind: 'select', options: ['go', 'maybe', 'no'] }, required: true },
    { name: 'note', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
