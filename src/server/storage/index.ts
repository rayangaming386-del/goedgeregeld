/**
 * Media-opslag.
 *
 *  - `local`: bestanden op schijf (MEDIA_LOCAL_DIR). Geschikt voor één server
 *    of een VPS. Webvarianten worden geserveerd via /media/…; originelen staan
 *    in een aparte map en worden nooit publiek geserveerd.
 *  - `s3`: S3-compatibele object storage (AWS S3, Cloudflare R2, MinIO).
 *    Klaar voor aansluiting; vereist de S3_*-variabelen uit .env.example.
 *  - `database`: bestanden in PostgreSQL (tabel media_objects), geserveerd
 *    via /media/… met CDN-caching. Standaard op Vercel, waar geen blijvende
 *    schijf is; ruim voldoende voor een wagenpark van deze omvang.
 *
 * Sleutels: `originals/<id>.<ext>` (privé) en `variants/<id>/<breedte>.<formaat>` (publiek).
 */
import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve, sep } from 'node:path'
import { AwsClient } from 'aws4fetch'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { mediaObjects } from '../db/schema'

export type StorageKind = 'local' | 's3' | 'database'

export interface StorageDriver {
  readonly kind: StorageKind
  put(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
  /** Publieke URL voor een variant. */
  publicUrl(key: string): string
}

export const PUBLIC_PREFIX = 'variants/'
export const PRIVATE_PREFIX = 'originals/'

const KEY_RE = /^(originals|variants)\/[a-z0-9][a-z0-9/_.-]*$/

export function assertSafeKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Ongeldige opslagsleutel: ${key}`)
  }
}

export class LocalStorage implements StorageDriver {
  readonly kind = 'local' as const
  private readonly root: string

  constructor(dir: string) {
    // Runtime-map voor uploads; niet meenemen in de build-tracing.
    this.root = resolve(/*turbopackIgnore: true*/ process.cwd(), dir)
  }

  private pathFor(key: string): string {
    assertSafeKey(key)
    const p = normalize(join(this.root, key))
    if (!p.startsWith(this.root + sep)) throw new Error('Pad buiten de opslagmap')
    return p
  }

  async put(key: string, body: Buffer): Promise<void> {
    const p = this.pathFor(key)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, body)
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    const file = this.pathFor(key)
    await rm(file, { force: true })
    // Lege mappen (bijv. variants/<id>/<versie>) opruimen, maar nooit de
    // hoofdmappen zelf (variants/, originals/).
    for (let dir = dirname(file); relative(this.root, dir).includes(sep); dir = dirname(dir)) {
      try {
        await rmdir(dir)
      } catch {
        break // niet leeg of al verwijderd
      }
    }
  }

  publicUrl(key: string): string {
    return `/media/${key.slice(PUBLIC_PREFIX.length)}`
  }
}

class S3Storage implements StorageDriver {
  readonly kind = 's3' as const
  private readonly client: AwsClient
  private readonly endpoint: string
  private readonly bucket: string
  private readonly publicBase: string

  constructor() {
    const endpoint = process.env.S3_ENDPOINT
    const bucket = process.env.S3_BUCKET
    const accessKeyId = process.env.S3_ACCESS_KEY_ID
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
    const publicBase = process.env.S3_PUBLIC_BASE_URL
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
      throw new Error('S3-opslag is gekozen maar S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY of S3_PUBLIC_BASE_URL ontbreekt.')
    }
    this.client = new AwsClient({ accessKeyId, secretAccessKey, region: process.env.S3_REGION || 'auto', service: 's3' })
    this.endpoint = endpoint.replace(/\/$/, '')
    this.bucket = bucket
    this.publicBase = publicBase.replace(/\/$/, '')
  }

  private url(key: string): string {
    assertSafeKey(key)
    return `${this.endpoint}/${this.bucket}/${key}`
  }

  async put(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: {
        'content-type': contentType,
        ...(cacheControl ? { 'cache-control': cacheControl } : {}),
      },
    })
    if (!res.ok) throw new Error(`Upload naar object storage mislukt (${res.status})`)
  }

  async get(key: string): Promise<Buffer | null> {
    const res = await this.client.fetch(this.url(key))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Ophalen uit object storage mislukt (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`Verwijderen uit object storage mislukt (${res.status})`)
  }

  publicUrl(key: string): string {
    // Alleen de variants/-map hoort publiek leesbaar te zijn (bucket policy).
    return `${this.publicBase}/${key}`
  }
}

export class DatabaseStorage implements StorageDriver {
  readonly kind = 'database' as const

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key)
    const values = { contentType, body, bytes: body.byteLength }
    await getDb()
      .insert(mediaObjects)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: mediaObjects.key, set: { ...values, createdAt: new Date() } })
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key)
    const [row] = await getDb().select({ body: mediaObjects.body }).from(mediaObjects).where(eq(mediaObjects.key, key))
    return row?.body ?? null
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key)
    await getDb().delete(mediaObjects).where(eq(mediaObjects.key, key))
  }

  publicUrl(key: string): string {
    return `/media/${key.slice(PUBLIC_PREFIX.length)}`
  }
}

/** De gekozen opslag. Zonder MEDIA_STORAGE: de database op Vercel, anders de lokale schijf. */
export function storageKind(): StorageKind {
  const kind = process.env.MEDIA_STORAGE?.trim()
  if (!kind) return process.env.VERCEL ? 'database' : 'local'
  if (kind === 'local' || kind === 's3' || kind === 'database') return kind
  throw new Error(`Onbekende MEDIA_STORAGE "${kind}". Kies local, s3 of database.`)
}

let driver: StorageDriver | null = null

export function getStorage(): StorageDriver {
  if (driver) return driver
  const kind = storageKind()
  driver =
    kind === 's3' ? new S3Storage() : kind === 'database' ? new DatabaseStorage() : new LocalStorage(process.env.MEDIA_LOCAL_DIR ?? './storage')
  return driver
}
