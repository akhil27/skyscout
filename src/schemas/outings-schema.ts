import type { CollectionSchema } from 'deepspace/schema'

/**
 * Stargazing outings. Collaborative planning: any signed-in member can read
 * and create; any member can update (status, guide, weather cache) so a group
 * can scout together. Deletes stay own-or-admin to avoid hijack.
 */
export const outingsSchema: CollectionSchema = {
  name: 'outings',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'placeName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'lat', storage: 'number', interpretation: 'plain' },
    { name: 'lng', storage: 'number', interpretation: 'plain' },
    { name: 'dateOptions', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'chosenDate', storage: 'text', interpretation: 'plain' },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'guide', storage: 'text', interpretation: 'plain' },
    { name: 'guideModel', storage: 'text', interpretation: 'plain' },
    { name: 'guideDate', storage: 'text', interpretation: 'plain' },
    { name: 'guideAt', storage: 'text', interpretation: 'plain' },
    { name: 'weatherCache', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'weatherAt', storage: 'text', interpretation: 'plain' },
    { name: 'goScore', storage: 'number', interpretation: 'plain' },
    { name: 'photoUrl', storage: 'text', interpretation: { kind: 'url' } },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: true, delete: 'own', writableFields: ['title', 'placeName', 'lat', 'lng', 'dateOptions', 'chosenDate', 'notes', 'status', 'photoUrl'] },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
