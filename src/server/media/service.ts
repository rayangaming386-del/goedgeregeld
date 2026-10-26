import { randomUUID } from 'node:crypto'
import { and, asc, eq, max } from 'drizzle-orm'
import { recordAudit } from '../audit'
import { media, vehicles, type Media } from '../db/schema'
import type { DbExecutor } from '../db/types'
import { getStorage, PRIVATE_PREFIX } from '../storage'
import { contentTypeForVariant, EXTENSION, processImage, VARIANT_CACHE_CONTROL } from './pipeline'

async function writeFiles(id: string, buffer: Buffer) {
  const storage = getStorage()
  const version = randomUUID().slice(0, 8)
  const processed = await processImage(buffer, `variants/${id}/${version}`)
  const originalKey = `${PRIVATE_PREFIX}${id}-${version}.${EXTENSION[processed.format]}`
  await storage.put(originalKey, buffer, processed.mime)
  for (const v of processed.variants) {
    await storage.put(v.key, v.buffer, contentTypeForVariant(v.format), VARIANT_CACHE_CONTROL)
  }
  return {
    processed,
    originalKey,
    variants: processed.variants.map(({ buffer: _b, ...rest }) => rest),
  }
}

async function removeFiles(row: Pick<Media, 'originalKey' | 'variants'>) {
  const storage = getStorage()
  await Promise.allSettled([storage.delete(row.originalKey), ...row.variants.map((v) => storage.delete(v.key))])
}

export type StoreImageInput = {
  buffer: Buffer
  originalName: string | null
  vehicleId: string | null
  actorId: string | null
  alt?: string
  focalX?: number
  focalY?: number
  isPublic?: boolean
  note?: string | null
  sourceUrl?: string | null
  sortOrder?: number
}

/** Valideert, verwerkt en bewaart een afbeelding. Gooit ImageValidationError bij ongeldige bestanden. */
export async function storeImage(db: DbExecutor, input: StoreImageInput): Promise<Media> {
  const id = randomUUID()
  const { processed, originalKey, variants } = await writeFiles(id, input.buffer)
  let sortOrder = input.sortOrder
  if (sortOrder === undefined && input.vehicleId) {
    const [row] = await db
      .select({ value: max(media.sortOrder) })
      .from(media)
      .where(eq(media.vehicleId, input.vehicleId))
    sortOrder = (row?.value ?? -1) + 1
  }
  try {
    const [row] = await db
      .insert(media)
      .values({
        id,
        vehicleId: input.vehicleId,
        originalKey,
        originalName: input.originalName?.slice(0, 200) ?? null,
        mime: processed.mime,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        sha256: processed.sha256,
        variants,
        placeholder: processed.placeholder,
        alt: input.alt ?? '',
        focalX: input.focalX ?? 50,
        focalY: input.focalY ?? 50,
        isPublic: input.isPublic ?? true,
        note: input.note ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sortOrder: sortOrder ?? 0,
        createdBy: input.actorId,
      })
      .returning()
    return row!
  } catch (err) {
    await removeFiles({ originalKey, variants })
    throw err
  }
}

/** Vervangt het bestand van een foto; alt-tekst, volgorde en focuspunt blijven behouden. */
export async function replaceImage(db: DbExecutor, mediaId: string, buffer: Buffer, originalName: string | null, actorId: string | null) {
  const [existing] = await db.select().from(media).where(eq(media.id, mediaId))
  if (!existing) throw new Error('Foto niet gevonden.')
  const { processed, originalKey, variants } = await writeFiles(mediaId, buffer)
  await db
    .update(media)
    .set({
      originalKey,
      originalName: originalName?.slice(0, 200) ?? null,
      mime: processed.mime,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      sha256: processed.sha256,
      variants,
      placeholder: processed.placeholder,
      updatedAt: new Date(),
    })
    .where(eq(media.id, mediaId))
  await removeFiles(existing)
  await recordAudit(db, {
    actorId,
    action: 'foto.vervangen',
    entityType: 'foto',
    entityId: mediaId,
    summary: `Foto vervangen${existing.vehicleId ? '' : ' (website)'}`,
  })
}

export async function deleteImage(db: DbExecutor, mediaId: string, actorId: string | null) {
  const [existing] = await db.select().from(media).where(eq(media.id, mediaId))
  if (!existing) return
  await db.update(vehicles).set({ primaryMediaId: null }).where(eq(vehicles.primaryMediaId, mediaId))
  await db.delete(media).where(eq(media.id, mediaId))
  await removeFiles(existing)
  await recordAudit(db, {
    actorId,
    action: 'foto.verwijderd',
    entityType: 'foto',
    entityId: mediaId,
    summary: `Foto verwijderd: ${existing.alt || existing.originalName || mediaId}`,
  })
}

/** Schrijft een nieuwe volgorde weg (alleen foto’s van deze auto). */
export async function reorderImages(db: DbExecutor, vehicleId: string, orderedIds: string[]) {
  const rows = await db.select({ id: media.id }).from(media).where(eq(media.vehicleId, vehicleId)).orderBy(asc(media.sortOrder))
  const known = new Set(rows.map((r) => r.id))
  const ids = orderedIds.filter((id) => known.has(id))
  for (const r of rows) if (!ids.includes(r.id)) ids.push(r.id)
  for (let i = 0; i < ids.length; i++) {
    await db
      .update(media)
      .set({ sortOrder: i })
      .where(and(eq(media.id, ids[i]!), eq(media.vehicleId, vehicleId)))
  }
}
