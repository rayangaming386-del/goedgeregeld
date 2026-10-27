import { readFile } from 'node:fs/promises'
import { count, like, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Vóór de imports: deze testfile gebruikt de database-opslag, zoals op Vercel.
vi.hoisted(() => {
  process.env.MEDIA_STORAGE = 'database'
})

import { GET } from '@/app/media/[...path]/route'
import { closeDb, getDb } from '@/server/db/client'
import { mediaObjects } from '@/server/db/schema'
import { deleteImage, storeImage } from '@/server/media/service'
import { DatabaseStorage, getStorage, storageKind } from '@/server/storage'

const db = () => getDb()

const objectCount = async (prefix: string) => {
  const [row] = await db().select({ n: count() }).from(mediaObjects).where(like(mediaObjects.key, `${prefix}%`))
  return row?.n ?? 0
}

const request = (path: string) => GET(new Request(`http://localhost/media/${path}`), { params: Promise.resolve({ path: path.split('/') }) })

beforeAll(async () => {
  await migrate(db(), { migrationsFolder: './drizzle' })
})

beforeEach(async () => {
  await db().execute(sql`TRUNCATE media_objects, media, audit_log RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await closeDb()
})

describe('foto’s in de database', () => {
  it('bewaart, overschrijft en verwijdert bestanden byte voor byte', async () => {
    const storage = new DatabaseStorage()
    const body = Buffer.from(Array.from({ length: 70_000 }, (_, i) => (i * 7919) % 256))
    await storage.put('variants/a/b/480.webp', body, 'image/webp')
    expect((await storage.get('variants/a/b/480.webp'))?.equals(body)).toBe(true)
    await storage.put('variants/a/b/480.webp', Buffer.from('nieuw'), 'image/webp')
    expect((await storage.get('variants/a/b/480.webp'))?.toString()).toBe('nieuw')
    await storage.delete('variants/a/b/480.webp')
    expect(await storage.get('variants/a/b/480.webp')).toBeNull()
    await expect(storage.put('../buiten', body, 'image/webp')).rejects.toThrow()
    await expect(storage.get('variants/../originals/x.jpg')).rejects.toThrow()
  })

  it('serveert webversies via /media met CDN-caching, maar nooit het origineel', async () => {
    expect(getStorage().kind).toBe('database')
    const buffer = await readFile('bronmateriaal/fotos/rsq3/rsq3-02.jpeg')
    const row = await storeImage(db(), { buffer, originalName: 'rsq3-02.jpeg', vehicleId: null, actorId: null, alt: 'Test' })

    const webp = row.variants.find((v) => v.format === 'webp')!
    const res = await request(webp.key.replace(/^variants\//, ''))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toContain('s-maxage=')
    expect(Buffer.from(await res.arrayBuffer()).byteLength).toBe(webp.bytes)

    // Het origineel staat wel in de database, maar is niet via de route op te vragen.
    expect(await objectCount(row.originalKey)).toBe(1)
    const originalFile = row.originalKey.replace(/^originals\//, '')
    expect((await request(originalFile)).status).toBe(404)
    expect((await request(`../${row.originalKey}`)).status).toBe(404)

    await deleteImage(db(), row.id, null)
    expect(await objectCount('variants/')).toBe(0)
    expect(await objectCount('originals/')).toBe(0)
    expect((await request(webp.key.replace(/^variants\//, ''))).status).toBe(404)
  })
})

describe('keuze van de opslag', () => {
  const saved = { MEDIA_STORAGE: process.env.MEDIA_STORAGE, VERCEL: process.env.VERCEL }
  afterEach(() => {
    process.env.MEDIA_STORAGE = saved.MEDIA_STORAGE
    if (saved.VERCEL === undefined) delete process.env.VERCEL
    else process.env.VERCEL = saved.VERCEL
  })

  it('kiest zonder instelling de database op Vercel en anders de lokale schijf', () => {
    delete process.env.MEDIA_STORAGE
    delete process.env.VERCEL
    expect(storageKind()).toBe('local')
    process.env.VERCEL = '1'
    expect(storageKind()).toBe('database')
    process.env.MEDIA_STORAGE = 's3'
    expect(storageKind()).toBe('s3')
    process.env.MEDIA_STORAGE = 'schijf'
    expect(() => storageKind()).toThrow(/Onbekende MEDIA_STORAGE/)
  })
})
