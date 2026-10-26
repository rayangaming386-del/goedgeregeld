/**
 * Aanvragen, opties, reserveringen en blokkades.
 *
 * Gelijktijdigheid: elke handeling die de auto blokkeert (bevestigen, optie
 * zetten, periode van een bevestigde reservering wijzigen, blokkade toevoegen)
 * neemt eerst een transactie-advisory-lock per auto. Twee beheerders die
 * tegelijk bevestigen worden zo achter elkaar afgehandeld; de tweede ziet de
 * eerste bevestiging en krijgt een conflictmelding. De exclusion-constraint
 * op bevestigde reserveringen is het vangnet op databaseniveau.
 */
import { and, desc, eq, gt, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import {
  blockingItems,
  findConflicts,
  type BlockingItem,
  type Interval,
} from '@/domain/availability'
import {
  canTransition,
  isOpen,
  OPEN_STATUSES,
  STATUS_LABELS,
  type ReservationStatus,
} from '@/domain/reservation-status'
import { normalizePhone } from '@/domain/request-validation'
import { formatPeriod } from '@/domain/time'
import { generateReference } from '@/lib/reference'
import { recordAudit } from '../audit'
import { getDb } from '../db/client'
import {
  availabilityBlocks,
  reservationEvents,
  reservationNotes,
  reservations,
  vehicles,
  type Reservation,
} from '../db/schema'
import type { DbExecutor } from '../db/types'
import { hashKey } from '../rate-limit'

export class ConflictError extends Error {
  constructor(public conflicts: BlockingItem[]) {
    super('De periode overlapt met een bevestigde reservering, een actieve optie of een blokkade.')
  }
}

export class TransitionError extends Error {}
export class NotFoundError extends Error {}

type Actor = { id: string; name: string } | null

const EXCLUSION_VIOLATION = '23P01'
const UNIQUE_VIOLATION = '23505'

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

async function lockVehicle(tx: DbExecutor, vehicleId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`voertuig:${vehicleId}`}, 0))`)
}

/** Blokkerende items voor een auto die met de periode overlappen. */
export async function conflictsFor(
  tx: DbExecutor,
  vehicleId: string,
  period: Interval,
  now: Date,
  exclude: { reservationId?: string; blockId?: string } = {},
  options: { includeBlocks?: boolean } = {},
): Promise<BlockingItem[]> {
  const resRows = await tx
    .select({
      id: reservations.id,
      reference: reservations.reference,
      status: reservations.status,
      optionExpiresAt: reservations.optionExpiresAt,
      start: reservations.startAt,
      end: reservations.endAt,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.vehicleId, vehicleId),
        lt(reservations.startAt, period.end),
        gt(reservations.endAt, period.start),
        inArray(reservations.status, ['bevestigd', ...OPEN_STATUSES]),
      ),
    )
  const blockRows =
    options.includeBlocks === false
      ? []
      : await tx
          .select({
            id: availabilityBlocks.id,
            kind: availabilityBlocks.kind,
            reason: availabilityBlocks.reason,
            start: availabilityBlocks.startAt,
            end: availabilityBlocks.endAt,
          })
          .from(availabilityBlocks)
          .where(
            and(
              eq(availabilityBlocks.vehicleId, vehicleId),
              lt(availabilityBlocks.startAt, period.end),
              gt(availabilityBlocks.endAt, period.start),
            ),
          )
  return findConflicts(
    period,
    blockingItems(resRows, blockRows, now, { excludeReservationId: exclude.reservationId, excludeBlockId: exclude.blockId }),
  )
}

async function insertEvent(
  tx: DbExecutor,
  e: { reservationId: string; kind: string; from?: ReservationStatus | null; to?: ReservationStatus | null; data?: Record<string, unknown>; actorId?: string | null },
) {
  await tx.insert(reservationEvents).values({
    reservationId: e.reservationId,
    kind: e.kind,
    fromStatus: e.from ?? null,
    toStatus: e.to ?? null,
    data: e.data ?? null,
    actorId: e.actorId ?? null,
  })
}

async function insertWithReference(tx: DbExecutor, values: Omit<typeof reservations.$inferInsert, 'reference'>): Promise<Reservation> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [row] = await tx
        .insert(reservations)
        .values({ ...values, reference: generateReference() })
        .returning()
      return row!
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION && attempt < 5) continue
      throw err
    }
  }
  throw new Error('Kon geen uniek aanvraagnummer maken.')
}

/* ───────────── Publieke aanvraag ───────────── */

export type WebsiteRequestInput = {
  vehicleId: string
  start: Date
  end: Date
  name: string
  phone: string
  email: string | null
  message: string | null
}

export type WebsiteRequestResult =
  | { kind: 'created'; id: string; reference: string }
  | { kind: 'duplicate'; id: string; reference: string }

/**
 * Slaat een aanvraag op (status “nieuw”). Een aanvraag blokkeert de auto niet.
 * Dezelfde aanvraag binnen 24 uur opnieuw versturen levert geen dubbel record op.
 */
export async function createWebsiteRequest(input: WebsiteRequestInput, db: DbExecutor = getDb()): Promise<WebsiteRequestResult> {
  const dedupeKey = hashKey(`${input.vehicleId}|${input.start.toISOString()}|${input.end.toISOString()}|${normalizePhone(input.phone)}`)
  const since = new Date(Date.now() - 24 * 3600_000)
  const [existing] = await db
    .select({ id: reservations.id, reference: reservations.reference })
    .from(reservations)
    .where(and(eq(reservations.dedupeKey, dedupeKey), gte(reservations.createdAt, since)))
    .orderBy(desc(reservations.createdAt))
    .limit(1)
  if (existing) return { kind: 'duplicate', ...existing }

  const row = await insertWithReference(db, {
    vehicleId: input.vehicleId,
    startAt: input.start,
    endAt: input.end,
    status: 'nieuw',
    customerName: input.name,
    customerPhone: input.phone,
    customerEmail: input.email,
    customerMessage: input.message,
    source: 'website',
    dedupeKey,
  })
  await insertEvent(db, { reservationId: row.id, kind: 'aangemaakt', to: 'nieuw', data: { bron: 'website' } })
  return { kind: 'created', id: row.id, reference: row.reference }
}

/* ───────────── Beheer ───────────── */

async function lockedReservation(tx: DbExecutor, id: string): Promise<Reservation> {
  const [row] = await tx.select().from(reservations).where(eq(reservations.id, id)).for('update')
  if (!row) throw new NotFoundError('Aanvraag niet gevonden.')
  return row
}

async function vehicleName(tx: DbExecutor, id: string): Promise<string> {
  const [v] = await tx.select({ name: vehicles.name }).from(vehicles).where(eq(vehicles.id, id))
  return v?.name ?? 'onbekende auto'
}

function translateDbError(err: unknown): never {
  if (pgCode(err) === EXCLUSION_VIOLATION) throw new ConflictError([])
  throw err
}

export async function changeStatus(
  args: { reservationId: string; to: ReservationStatus; actor: Actor; now?: Date },
  db = getDb(),
): Promise<Reservation> {
  const now = args.now ?? new Date()
  try {
    return await db.transaction(async (tx) => {
      const current = await lockedReservation(tx, args.reservationId)
      if (current.status === args.to) return current
      if (!canTransition(current.status, args.to)) {
        throw new TransitionError(`Van “${STATUS_LABELS[current.status]}” naar “${STATUS_LABELS[args.to]}” is niet mogelijk.`)
      }
      if (args.to === 'bevestigd') {
        await lockVehicle(tx, current.vehicleId)
        const conflicts = await conflictsFor(tx, current.vehicleId, { start: current.startAt, end: current.endAt }, now, {
          reservationId: current.id,
        })
        if (conflicts.length) throw new ConflictError(conflicts)
      }
      const leavingOpen = !isOpen(args.to)
      const [updated] = await tx
        .update(reservations)
        .set({
          status: args.to,
          updatedAt: now,
          ...(args.to === 'bevestigd' ? { confirmedAt: now, confirmedBy: args.actor?.id ?? null } : {}),
          ...(leavingOpen ? { optionExpiresAt: null } : {}),
        })
        .where(eq(reservations.id, current.id))
        .returning()
      await insertEvent(tx, {
        reservationId: current.id,
        kind: 'status',
        from: current.status,
        to: args.to,
        actorId: args.actor?.id,
        data: leavingOpen && current.optionExpiresAt ? { optieVervallen: true } : undefined,
      })
      await recordAudit(tx, {
        actorId: args.actor?.id ?? null,
        action: args.to === 'bevestigd' ? 'reservering.bevestigd' : 'aanvraag.status',
        entityType: 'aanvraag',
        entityId: current.id,
        summary: `${current.reference}: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[args.to]}`,
        changes: { status: { van: current.status, naar: args.to } },
      })
      return updated!
    })
  } catch (err) {
    translateDbError(err)
  }
}

/** Zet of verwijdert een tijdelijke optie. Een optie blokkeert de auto tot de vervaldatum. */
export async function setOption(
  args: { reservationId: string; expiresAt: Date | null; actor: Actor; now?: Date },
  db = getDb(),
): Promise<Reservation> {
  const now = args.now ?? new Date()
  return db.transaction(async (tx) => {
    const current = await lockedReservation(tx, args.reservationId)
    if (args.expiresAt) {
      if (!isOpen(current.status)) throw new TransitionError('Alleen een open aanvraag kan een tijdelijke optie krijgen.')
      if (args.expiresAt.getTime() <= now.getTime()) throw new TransitionError('De vervaldatum van de optie moet in de toekomst liggen.')
      await lockVehicle(tx, current.vehicleId)
      const conflicts = await conflictsFor(tx, current.vehicleId, { start: current.startAt, end: current.endAt }, now, {
        reservationId: current.id,
      })
      if (conflicts.length) throw new ConflictError(conflicts)
    }
    const [updated] = await tx
      .update(reservations)
      .set({ optionExpiresAt: args.expiresAt, updatedAt: now })
      .where(eq(reservations.id, current.id))
      .returning()
    await insertEvent(tx, {
      reservationId: current.id,
      kind: 'optie',
      actorId: args.actor?.id,
      data: { van: current.optionExpiresAt?.toISOString() ?? null, naar: args.expiresAt?.toISOString() ?? null },
    })
    await recordAudit(tx, {
      actorId: args.actor?.id ?? null,
      action: args.expiresAt ? 'aanvraag.optie_gezet' : 'aanvraag.optie_verwijderd',
      entityType: 'aanvraag',
      entityId: current.id,
      summary: args.expiresAt ? `${current.reference}: tijdelijke optie gezet` : `${current.reference}: tijdelijke optie verwijderd`,
    })
    return updated!
  })
}

/** Wijzigt periode (en eventueel auto). Bij een bevestigde reservering of actieve optie met overlapcontrole. */
export async function updatePeriod(
  args: { reservationId: string; start: Date; end: Date; vehicleId?: string; actor: Actor; now?: Date },
  db = getDb(),
): Promise<Reservation> {
  const now = args.now ?? new Date()
  if (!(args.end.getTime() > args.start.getTime())) throw new TransitionError('Het einde moet na het begin liggen.')
  try {
    return await db.transaction(async (tx) => {
      const current = await lockedReservation(tx, args.reservationId)
      if (current.status === 'afgerond' || current.status === 'afgewezen' || current.status === 'geannuleerd') {
        throw new TransitionError('De periode van een gesloten aanvraag kan niet worden gewijzigd.')
      }
      const vehicleId = args.vehicleId ?? current.vehicleId
      const blocking =
        current.status === 'bevestigd' || (current.optionExpiresAt !== null && current.optionExpiresAt.getTime() > now.getTime())
      if (blocking) {
        await lockVehicle(tx, vehicleId)
        const conflicts = await conflictsFor(tx, vehicleId, { start: args.start, end: args.end }, now, { reservationId: current.id })
        if (conflicts.length) throw new ConflictError(conflicts)
      }
      const [updated] = await tx
        .update(reservations)
        .set({ startAt: args.start, endAt: args.end, vehicleId, updatedAt: now })
        .where(eq(reservations.id, current.id))
        .returning()
      const before = formatPeriod(current.startAt, current.endAt)
      const after = formatPeriod(args.start, args.end)
      await insertEvent(tx, {
        reservationId: current.id,
        kind: 'periode',
        actorId: args.actor?.id,
        data: {
          van: before,
          naar: after,
          ...(vehicleId !== current.vehicleId ? { autoVan: await vehicleName(tx, current.vehicleId), autoNaar: await vehicleName(tx, vehicleId) } : {}),
        },
      })
      await recordAudit(tx, {
        actorId: args.actor?.id ?? null,
        action: 'aanvraag.periode',
        entityType: 'aanvraag',
        entityId: current.id,
        summary: `${current.reference}: periode gewijzigd`,
        changes: {
          periode: { van: before, naar: after },
          ...(vehicleId !== current.vehicleId ? { auto: { van: current.vehicleId, naar: vehicleId } } : {}),
        },
      })
      return updated!
    })
  } catch (err) {
    translateDbError(err)
  }
}

export async function updateCustomer(
  args: { reservationId: string; name: string; phone: string; email: string | null; actor: Actor },
  db = getDb(),
) {
  await db.transaction(async (tx) => {
    const current = await lockedReservation(tx, args.reservationId)
    await tx
      .update(reservations)
      .set({ customerName: args.name, customerPhone: args.phone, customerEmail: args.email, updatedAt: new Date() })
      .where(eq(reservations.id, current.id))
    await insertEvent(tx, { reservationId: current.id, kind: 'klantgegevens', actorId: args.actor?.id })
    await recordAudit(tx, {
      actorId: args.actor?.id ?? null,
      action: 'aanvraag.klantgegevens',
      entityType: 'aanvraag',
      entityId: current.id,
      summary: `${current.reference}: klantgegevens bijgewerkt`,
    })
  })
}

export type ManualInput = {
  vehicleId: string
  start: Date
  end: Date
  name: string
  phone: string
  email: string | null
  message: string | null
  source: 'whatsapp' | 'telefoon' | 'instagram' | 'handmatig'
  status: 'nieuw' | 'in_behandeling' | 'bevestigd'
  optionExpiresAt: Date | null
  actor: Actor
  now?: Date
}

/** Handmatig een aanvraag of (direct bevestigde) reservering toevoegen. */
export async function createManual(input: ManualInput, db = getDb()): Promise<Reservation> {
  const now = input.now ?? new Date()
  if (!(input.end.getTime() > input.start.getTime())) throw new TransitionError('Het einde moet na het begin liggen.')
  try {
    return await db.transaction(async (tx) => {
      const blocks = input.status === 'bevestigd' || (input.optionExpiresAt && input.optionExpiresAt.getTime() > now.getTime())
      if (input.optionExpiresAt && input.status === 'bevestigd') throw new TransitionError('Een bevestigde reservering heeft geen optie nodig.')
      if (input.optionExpiresAt && input.optionExpiresAt.getTime() <= now.getTime()) {
        throw new TransitionError('De vervaldatum van de optie moet in de toekomst liggen.')
      }
      if (blocks) {
        await lockVehicle(tx, input.vehicleId)
        const conflicts = await conflictsFor(tx, input.vehicleId, { start: input.start, end: input.end }, now)
        if (conflicts.length) throw new ConflictError(conflicts)
      }
      const row = await insertWithReference(tx, {
        vehicleId: input.vehicleId,
        startAt: input.start,
        endAt: input.end,
        status: input.status,
        optionExpiresAt: input.optionExpiresAt,
        customerName: input.name,
        customerPhone: input.phone,
        customerEmail: input.email,
        customerMessage: input.message,
        source: input.source,
        createdBy: input.actor?.id ?? null,
        ...(input.status === 'bevestigd' ? { confirmedAt: now, confirmedBy: input.actor?.id ?? null } : {}),
      })
      await insertEvent(tx, { reservationId: row.id, kind: 'aangemaakt', to: input.status, actorId: input.actor?.id, data: { bron: input.source } })
      await recordAudit(tx, {
        actorId: input.actor?.id ?? null,
        action: input.status === 'bevestigd' ? 'reservering.handmatig' : 'aanvraag.handmatig',
        entityType: 'aanvraag',
        entityId: row.id,
        summary: `${row.reference}: handmatig toegevoegd (${STATUS_LABELS[input.status]})`,
      })
      return row
    })
  } catch (err) {
    translateDbError(err)
  }
}

export async function addNote(args: { reservationId: string; body: string; actor: Actor }, db = getDb()) {
  const body = args.body.trim()
  if (!body) throw new TransitionError('Een notitie mag niet leeg zijn.')
  if (body.length > 2000) throw new TransitionError('Een notitie is maximaal 2000 tekens.')
  await db.transaction(async (tx) => {
    const current = await lockedReservation(tx, args.reservationId)
    await tx.insert(reservationNotes).values({ reservationId: current.id, body, authorId: args.actor?.id ?? null })
    await insertEvent(tx, { reservationId: current.id, kind: 'notitie', actorId: args.actor?.id })
  })
}

/* ───────────── Blokkades ───────────── */

export async function createBlock(
  args: { vehicleId: string; kind: 'onderhoud' | 'blokkade'; start: Date; end: Date; reason: string; actor: Actor; now?: Date },
  db = getDb(),
) {
  const now = args.now ?? new Date()
  if (!(args.end.getTime() > args.start.getTime())) throw new TransitionError('Het einde moet na het begin liggen.')
  return db.transaction(async (tx) => {
    await lockVehicle(tx, args.vehicleId)
    // Blokkades mogen elkaar overlappen; bevestigde reserveringen en opties niet.
    const conflicts = await conflictsFor(tx, args.vehicleId, { start: args.start, end: args.end }, now, {}, { includeBlocks: false })
    if (conflicts.length) throw new ConflictError(conflicts)
    const [row] = await tx
      .insert(availabilityBlocks)
      .values({
        vehicleId: args.vehicleId,
        kind: args.kind,
        startAt: args.start,
        endAt: args.end,
        reason: args.reason.trim().slice(0, 200),
        createdBy: args.actor?.id ?? null,
      })
      .returning()
    await recordAudit(tx, {
      actorId: args.actor?.id ?? null,
      action: 'blokkade.toegevoegd',
      entityType: 'blokkade',
      entityId: row!.id,
      summary: `${args.kind === 'onderhoud' ? 'Onderhoud' : 'Blokkade'} voor ${await vehicleName(tx, args.vehicleId)}: ${formatPeriod(args.start, args.end)}`,
    })
    return row!
  })
}

export async function deleteBlock(args: { blockId: string; actor: Actor }, db = getDb()) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(availabilityBlocks).where(eq(availabilityBlocks.id, args.blockId))
    if (!row) return
    await tx.delete(availabilityBlocks).where(eq(availabilityBlocks.id, row.id))
    await recordAudit(tx, {
      actorId: args.actor?.id ?? null,
      action: 'blokkade.verwijderd',
      entityType: 'blokkade',
      entityId: row.id,
      summary: `Blokkade verwijderd: ${formatPeriod(row.startAt, row.endAt)}`,
    })
  })
}

/** Open aanvragen die overlappen met een gegeven periode (voor waarschuwingen). */
export async function overlappingRequests(vehicleId: string, period: Interval, excludeId?: string, db: DbExecutor = getDb()) {
  return db
    .select({ id: reservations.id, reference: reservations.reference, status: reservations.status, start: reservations.startAt, end: reservations.endAt })
    .from(reservations)
    .where(
      and(
        eq(reservations.vehicleId, vehicleId),
        lt(reservations.startAt, period.end),
        gt(reservations.endAt, period.start),
        inArray(reservations.status, [...OPEN_STATUSES]),
        excludeId ? ne(reservations.id, excludeId) : undefined,
      ),
    )
}
