/**
 * Wagenparkbeheer. Elke wijziging krijgt een auditregel met oude en nieuwe
 * waarden en een revisie (herstelbaar). Verandert een gegeven dat de eigenaar
 * had bevestigd, dan vervalt die bevestiging automatisch, tenzij de eigenaar
 * de nieuwe waarde in dezelfde handeling bevestigt.
 */
import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm'
import { slugify } from '@/lib/slug'
import { diff, recordAudit, recordRevision, type Changes } from '../audit'
import { getDb } from '../db/client'
import { media, reservations, vehicles, vehicleVerifications, type Vehicle } from '../db/schema'
import type { DbExecutor } from '../db/types'

export type VerificationField = (typeof vehicleVerifications.$inferSelect)['field']

export const VERIFICATION_FIELDS: Array<{ field: VerificationField; label: string; hint: string }> = [
  { field: 'dagprijs', label: 'Dagprijs', hint: 'De dagprijs klopt en mag als prijs vanaf worden getoond.' },
  { field: 'borg', label: 'Borg', hint: 'Het borgbedrag klopt.' },
  { field: 'tariefregels', label: 'Overige tarieven', hint: 'Weekend- en weektarief en aanvullende kosten kloppen (of zijn bewust leeg).' },
  { field: 'specificaties', label: 'Specificaties', hint: 'Vermogen, koppel, acceleratie, transmissie en bouwjaar kloppen voor deze auto.' },
  { field: 'voorwaarden', label: 'Voorwaarden', hint: 'Minimumleeftijd, kilometerregeling en kentekenland kloppen.' },
  { field: 'uitvoering', label: 'Uitvoering', hint: 'Editie, aanpassingen (zoals downpipe/Stage 2) en kenmerken kloppen.' },
  { field: 'fotos', label: 'Foto’s', hint: 'De foto’s mogen op deze website worden gebruikt.' },
]

export class VehicleError extends Error {}

type Actor = { id: string; name: string } | null

const GENERAL_FIELDS = ['name', 'brand', 'model', 'edition', 'tagline', 'description', 'highlights', 'featured'] as const
const SPEC_FIELDS = ['powerHp', 'torqueNm', 'accelTenths', 'transmission', 'modelYear'] as const
const TERM_FIELDS = ['minAge', 'mileagePolicy', 'plateCountry'] as const
const PRICE_FIELDS = ['dayRateCents', 'weekendRateCents', 'weekRateCents', 'depositCents', 'extraCosts'] as const
const SEO_FIELDS = ['slug', 'seoTitle', 'seoDescription'] as const

async function load(db: DbExecutor, id: string): Promise<Vehicle> {
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id))
  if (!row) throw new VehicleError('Auto niet gevonden.')
  return row
}

function snapshot(v: Vehicle) {
  const { createdAt: _c, updatedAt: _u, ...rest } = v
  return rest
}

async function revokeIfChanged(db: DbExecutor, vehicleId: string, field: VerificationField, changed: boolean, keep: boolean) {
  if (changed && !keep) {
    await db.delete(vehicleVerifications).where(and(eq(vehicleVerifications.vehicleId, vehicleId), eq(vehicleVerifications.field, field)))
  }
}

async function confirmField(db: DbExecutor, vehicleId: string, field: VerificationField, actor: Actor) {
  await db
    .insert(vehicleVerifications)
    .values({ vehicleId, field, confirmedBy: actor?.id ?? null, confirmedAt: new Date() })
    .onConflictDoUpdate({
      target: [vehicleVerifications.vehicleId, vehicleVerifications.field],
      set: { confirmedBy: actor?.id ?? null, confirmedAt: new Date() },
    })
}

async function saveWithHistory(
  db: DbExecutor,
  current: Vehicle,
  patch: Partial<Vehicle>,
  fields: readonly (keyof Vehicle)[],
  actor: Actor,
  action: string,
  label: string,
): Promise<Changes> {
  const changes = diff(current as unknown as Record<string, unknown>, patch as Record<string, unknown>, fields as string[])
  if (!Object.keys(changes).length) return changes
  await recordRevision(db, { entityType: 'auto', entityId: current.id, snapshot: snapshot(current), actorId: actor?.id ?? null, summary: `Vóór: ${label}` })
  await db
    .update(vehicles)
    .set({ ...patch, updatedAt: new Date(), updatedBy: actor?.id ?? null })
    .where(eq(vehicles.id, current.id))
  await recordAudit(db, {
    actorId: actor?.id ?? null,
    action,
    entityType: 'auto',
    entityId: current.id,
    summary: `${current.name}: ${label}`,
    changes,
  })
  return changes
}

export async function createVehicle(input: { name: string; model: string; brand: string }, actor: Actor, db = getDb()) {
  const base = slugify(`${input.brand} ${input.model}`) || slugify(input.name) || 'auto'
  let slug = base
  for (let i = 2; ; i++) {
    const [taken] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.slug, slug))
    if (!taken) break
    slug = `${base}-${i}`
  }
  const [{ max } = { max: -1 }] = await db.select({ max: sql<number>`coalesce(max(${vehicles.sortOrder}), -1)` }).from(vehicles)
  const [row] = await db
    .insert(vehicles)
    .values({ name: input.name, model: input.model, brand: input.brand, slug, status: 'concept', sortOrder: Number(max) + 1, updatedBy: actor?.id ?? null })
    .returning()
  await recordAudit(db, { actorId: actor?.id ?? null, action: 'auto.aangemaakt', entityType: 'auto', entityId: row!.id, summary: `Auto toegevoegd: ${input.name} (concept)` })
  return row!
}

export async function updateGeneral(
  id: string,
  patch: Pick<Vehicle, (typeof GENERAL_FIELDS)[number]>,
  opts: { actor: Actor; confirm: boolean },
  db = getDb(),
) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    const changes = await saveWithHistory(tx, current, patch, GENERAL_FIELDS, opts.actor, 'auto.algemeen', 'algemene gegevens bijgewerkt')
    const execChanged = 'edition' in changes || 'highlights' in changes
    await revokeIfChanged(tx, id, 'uitvoering', execChanged, opts.confirm)
    if (opts.confirm) await confirmField(tx, id, 'uitvoering', opts.actor)
    return changes
  })
}

export async function updateSpecs(
  id: string,
  patch: Pick<Vehicle, (typeof SPEC_FIELDS)[number] | (typeof TERM_FIELDS)[number]>,
  opts: { actor: Actor; confirmSpecs: boolean; confirmTerms: boolean },
  db = getDb(),
) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    const changes = await saveWithHistory(tx, current, patch, [...SPEC_FIELDS, ...TERM_FIELDS], opts.actor, 'auto.specificaties', 'specificaties en voorwaarden bijgewerkt')
    await revokeIfChanged(tx, id, 'specificaties', SPEC_FIELDS.some((f) => f in changes), opts.confirmSpecs)
    await revokeIfChanged(tx, id, 'voorwaarden', TERM_FIELDS.some((f) => f in changes), opts.confirmTerms)
    if (opts.confirmSpecs) await confirmField(tx, id, 'specificaties', opts.actor)
    if (opts.confirmTerms) await confirmField(tx, id, 'voorwaarden', opts.actor)
    return changes
  })
}

export async function updatePricing(
  id: string,
  patch: Pick<Vehicle, (typeof PRICE_FIELDS)[number]>,
  opts: { actor: Actor; confirmDay: boolean; confirmDeposit: boolean; confirmRules: boolean },
  db = getDb(),
) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    const changes = await saveWithHistory(tx, current, patch, PRICE_FIELDS, opts.actor, 'auto.prijzen', 'prijzen gewijzigd')
    await revokeIfChanged(tx, id, 'dagprijs', 'dayRateCents' in changes, opts.confirmDay)
    await revokeIfChanged(tx, id, 'borg', 'depositCents' in changes, opts.confirmDeposit)
    await revokeIfChanged(tx, id, 'tariefregels', ['weekendRateCents', 'weekRateCents', 'extraCosts'].some((f) => f in changes), opts.confirmRules)
    if (opts.confirmDay) await confirmField(tx, id, 'dagprijs', opts.actor)
    if (opts.confirmDeposit) await confirmField(tx, id, 'borg', opts.actor)
    if (opts.confirmRules) await confirmField(tx, id, 'tariefregels', opts.actor)
    return changes
  })
}

export async function updateSeo(id: string, patch: Pick<Vehicle, (typeof SEO_FIELDS)[number]>, actor: Actor, db = getDb()) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    if (patch.slug !== current.slug) {
      const [taken] = await tx.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.slug, patch.slug), ne(vehicles.id, id)))
      if (taken) throw new VehicleError('Deze slug is al in gebruik door een andere auto.')
    }
    return saveWithHistory(tx, current, patch, SEO_FIELDS, actor, 'auto.seo', 'URL en zoekmachinegegevens bijgewerkt')
  })
}

export async function setVerification(id: string, field: VerificationField, confirmed: boolean, actor: Actor, db = getDb()) {
  await db.transaction(async (tx) => {
    const current = await load(tx, id)
    if (confirmed) await confirmField(tx, id, field, actor)
    else await tx.delete(vehicleVerifications).where(and(eq(vehicleVerifications.vehicleId, id), eq(vehicleVerifications.field, field)))
    const label = VERIFICATION_FIELDS.find((f) => f.field === field)?.label ?? field
    await recordAudit(tx, {
      actorId: actor?.id ?? null,
      action: confirmed ? 'auto.bevestigd' : 'auto.bevestiging_ingetrokken',
      entityType: 'auto',
      entityId: id,
      summary: `${current.name}: ${label.toLowerCase()} ${confirmed ? 'bevestigd' : 'niet meer bevestigd'}`,
    })
  })
}

export async function setStatus(id: string, status: Vehicle['status'], actor: Actor, db = getDb()) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    if (current.status === status) return current
    if (status === 'gepubliceerd') {
      const [photos] = await tx.select({ n: count() }).from(media).where(and(eq(media.vehicleId, id), eq(media.isPublic, true)))
      const problems: string[] = []
      if (!current.name.trim()) problems.push('een naam')
      if (!current.tagline.trim()) problems.push('een korte omschrijving')
      if (!photos || photos.n === 0) problems.push('minstens één publieke foto')
      if (problems.length) throw new VehicleError(`Publiceren kan nog niet: de auto heeft ${problems.join(', ')} nodig.`)
    }
    const now = new Date()
    const [row] = await tx
      .update(vehicles)
      .set({
        status,
        updatedAt: now,
        updatedBy: actor?.id ?? null,
        ...(status === 'gepubliceerd' ? { publishedAt: now, archivedAt: null } : {}),
        ...(status === 'gearchiveerd' ? { archivedAt: now, featured: false } : {}),
      })
      .where(eq(vehicles.id, id))
      .returning()
    const verb = status === 'gepubliceerd' ? 'gepubliceerd' : status === 'gearchiveerd' ? 'gearchiveerd' : 'teruggezet naar concept'
    await recordAudit(tx, {
      actorId: actor?.id ?? null,
      action: `auto.${status}`,
      entityType: 'auto',
      entityId: id,
      summary: `${current.name} ${verb}`,
      changes: { status: { van: current.status, naar: status } },
    })
    return row!
  })
}

/** Verwijderen kan alleen zonder reserveringshistorie; anders archiveren. */
export async function deleteVehicle(id: string, actor: Actor, db = getDb()) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    const [res] = await tx.select({ n: count() }).from(reservations).where(eq(reservations.vehicleId, id))
    if (res && res.n > 0) {
      throw new VehicleError('Deze auto heeft aanvragen of reserveringen. Archiveer de auto, zodat de historie bewaard blijft.')
    }
    const photos = await tx.select({ originalKey: media.originalKey, variants: media.variants }).from(media).where(eq(media.vehicleId, id))
    await tx.delete(vehicles).where(eq(vehicles.id, id))
    await recordAudit(tx, { actorId: actor?.id ?? null, action: 'auto.verwijderd', entityType: 'auto', entityId: id, summary: `Auto verwijderd: ${current.name}` })
    // Bestanden worden na de transactie verwijderd door de aanroeper.
    return photos
  })
}

export async function moveVehicle(id: string, direction: 'omhoog' | 'omlaag', actor: Actor, db = getDb()) {
  await db.transaction(async (tx) => {
    const rows = await tx.select({ id: vehicles.id, name: vehicles.name }).from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.name))
    const i = rows.findIndex((r) => r.id === id)
    const j = direction === 'omhoog' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= rows.length) return
    ;[rows[i], rows[j]] = [rows[j]!, rows[i]!]
    for (let k = 0; k < rows.length; k++) await tx.update(vehicles).set({ sortOrder: k }).where(eq(vehicles.id, rows[k]!.id))
    await recordAudit(tx, { actorId: actor?.id ?? null, action: 'auto.volgorde', entityType: 'auto', entityId: id, summary: `Volgorde gewijzigd: ${rows[j]!.name} ${direction}` })
  })
}

export async function setFeatured(id: string, featured: boolean, actor: Actor, db = getDb()) {
  await db.transaction(async (tx) => {
    const current = await load(tx, id)
    await tx.update(vehicles).set({ featured, updatedAt: new Date(), updatedBy: actor?.id ?? null }).where(eq(vehicles.id, id))
    await recordAudit(tx, {
      actorId: actor?.id ?? null,
      action: 'auto.uitgelicht',
      entityType: 'auto',
      entityId: id,
      summary: `${current.name} ${featured ? 'uitgelicht' : 'niet meer uitgelicht'}`,
    })
  })
}

/** Zet tekst- en gegevensvelden terug naar een eerdere revisie (foto’s en status blijven ongemoeid). */
export async function restoreRevision(id: string, snapshotValue: Record<string, unknown>, actor: Actor, db = getDb()) {
  return db.transaction(async (tx) => {
    const current = await load(tx, id)
    const fields = [...GENERAL_FIELDS, ...SPEC_FIELDS, ...TERM_FIELDS, ...PRICE_FIELDS, 'seoTitle', 'seoDescription'] as const
    const patch: Record<string, unknown> = {}
    for (const f of fields) if (f in snapshotValue) patch[f] = snapshotValue[f]
    const changes = await saveWithHistory(tx, current, patch as Partial<Vehicle>, fields, actor, 'auto.hersteld', 'eerdere versie hersteld')
    // Herstelde gegevens moeten opnieuw bevestigd worden.
    if (Object.keys(changes).length) {
      const affected = new Set<VerificationField>()
      if ('dayRateCents' in changes) affected.add('dagprijs')
      if ('depositCents' in changes) affected.add('borg')
      if (['weekendRateCents', 'weekRateCents', 'extraCosts'].some((f) => f in changes)) affected.add('tariefregels')
      if (SPEC_FIELDS.some((f) => f in changes)) affected.add('specificaties')
      if (TERM_FIELDS.some((f) => f in changes)) affected.add('voorwaarden')
      if ('edition' in changes || 'highlights' in changes) affected.add('uitvoering')
      if (affected.size) {
        await tx
          .delete(vehicleVerifications)
          .where(and(eq(vehicleVerifications.vehicleId, id), inArray(vehicleVerifications.field, [...affected])))
      }
    }
    return changes
  })
}
