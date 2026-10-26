import 'server-only'
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { OPEN_STATUSES, type ReservationStatus } from '@/domain/reservation-status'
import { getDb } from '../db/client'
import {
  auditLog,
  availabilityBlocks,
  faqs,
  pages,
  promotions,
  reservationEvents,
  reservationNotes,
  reservations,
  users,
  vehicles,
  vehicleVerifications,
} from '../db/schema'

export async function vehicleOptions() {
  return getDb()
    .select({ id: vehicles.id, name: vehicles.name, model: vehicles.model, status: vehicles.status, slug: vehicles.slug })
    .from(vehicles)
    .orderBy(asc(vehicles.sortOrder), asc(vehicles.name))
}

export async function newRequestCount(): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(reservations).where(eq(reservations.status, 'nieuw'))
  return row?.n ?? 0
}

/* ───────────── Dashboard ───────────── */

export async function dashboardData(now = new Date()) {
  const db = getDb()
  const in30 = new Date(now.getTime() + 30 * 86_400_000)
  const [
    [newCount],
    [openCount],
    upcoming,
    blocks,
    recentVehicles,
    activePromos,
    [conceptFaqs],
    conceptPages,
    latestNew,
    verifications,
    publishedVehicles,
  ] = await Promise.all([
    db.select({ n: count() }).from(reservations).where(eq(reservations.status, 'nieuw')),
    db.select({ n: count() }).from(reservations).where(inArray(reservations.status, [...OPEN_STATUSES])),
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        startAt: reservations.startAt,
        endAt: reservations.endAt,
        customerName: reservations.customerName,
        vehicle: vehicles.name,
      })
      .from(reservations)
      .innerJoin(vehicles, eq(vehicles.id, reservations.vehicleId))
      .where(and(eq(reservations.status, 'bevestigd'), gt(reservations.endAt, now), lt(reservations.startAt, in30)))
      .orderBy(asc(reservations.startAt))
      .limit(8),
    db
      .select({
        id: availabilityBlocks.id,
        kind: availabilityBlocks.kind,
        startAt: availabilityBlocks.startAt,
        endAt: availabilityBlocks.endAt,
        reason: availabilityBlocks.reason,
        vehicle: vehicles.name,
      })
      .from(availabilityBlocks)
      .innerJoin(vehicles, eq(vehicles.id, availabilityBlocks.vehicleId))
      .where(gt(availabilityBlocks.endAt, now))
      .orderBy(asc(availabilityBlocks.startAt))
      .limit(8),
    db
      .select({ id: vehicles.id, name: vehicles.name, status: vehicles.status, updatedAt: vehicles.updatedAt })
      .from(vehicles)
      .orderBy(desc(vehicles.updatedAt))
      .limit(5),
    db
      .select({ id: promotions.id, title: promotions.title, endsAt: promotions.endsAt })
      .from(promotions)
      .where(and(eq(promotions.status, 'gepubliceerd'), lte(promotions.startsAt, now), gt(promotions.endsAt, now)))
      .orderBy(asc(promotions.endsAt)),
    db.select({ n: count() }).from(faqs).where(eq(faqs.status, 'concept')),
    db.select({ slug: pages.slug, title: pages.title }).from(pages).where(eq(pages.status, 'concept')),
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        startAt: reservations.startAt,
        endAt: reservations.endAt,
        customerName: reservations.customerName,
        createdAt: reservations.createdAt,
        vehicle: vehicles.name,
      })
      .from(reservations)
      .innerJoin(vehicles, eq(vehicles.id, reservations.vehicleId))
      .where(eq(reservations.status, 'nieuw'))
      .orderBy(desc(reservations.createdAt))
      .limit(6),
    db.select({ vehicleId: vehicleVerifications.vehicleId, field: vehicleVerifications.field }).from(vehicleVerifications),
    db.select({ id: vehicles.id }).from(vehicles).where(ne(vehicles.status, 'gearchiveerd')),
  ])
  const fieldsPerVehicle = 7
  const unconfirmed = publishedVehicles.length * fieldsPerVehicle - verifications.filter((v) => publishedVehicles.some((p) => p.id === v.vehicleId)).length
  return {
    newCount: newCount?.n ?? 0,
    openCount: openCount?.n ?? 0,
    upcoming,
    blocks,
    recentVehicles,
    activePromos,
    conceptFaqs: conceptFaqs?.n ?? 0,
    conceptPages,
    latestNew,
    unconfirmed,
  }
}

/* ───────────── Aanvragen ───────────── */

export type RequestFilters = {
  status?: string
  auto?: string
  q?: string
  van?: Date
  tot?: Date
  pagina?: number
}

export const PAGE_SIZE = 25

export async function listRequests(f: RequestFilters) {
  const db = getDb()
  const where: SQL[] = []
  if (f.status === 'open') where.push(inArray(reservations.status, [...OPEN_STATUSES]))
  else if (f.status && f.status !== 'alle') where.push(eq(reservations.status, f.status as ReservationStatus))
  if (f.auto) where.push(eq(reservations.vehicleId, f.auto))
  if (f.q) {
    const q = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    where.push(or(ilike(reservations.reference, q), ilike(reservations.customerName, q), ilike(reservations.customerPhone, q))!)
  }
  if (f.van) where.push(gte(reservations.endAt, f.van))
  if (f.tot) where.push(lte(reservations.startAt, f.tot))
  const page = Math.max(1, f.pagina ?? 1)
  const condition = where.length ? and(...where) : undefined
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        status: reservations.status,
        optionExpiresAt: reservations.optionExpiresAt,
        startAt: reservations.startAt,
        endAt: reservations.endAt,
        customerName: reservations.customerName,
        customerPhone: reservations.customerPhone,
        source: reservations.source,
        createdAt: reservations.createdAt,
        vehicle: vehicles.name,
        vehicleId: vehicles.id,
      })
      .from(reservations)
      .innerJoin(vehicles, eq(vehicles.id, reservations.vehicleId))
      .where(condition)
      .orderBy(
        sql`CASE WHEN ${reservations.status} = 'nieuw' THEN 0 WHEN ${reservations.status} IN ('in_behandeling','wacht_op_klant') THEN 1 ELSE 2 END`,
        desc(reservations.createdAt),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(reservations).where(condition),
  ])
  return { rows, total: total?.n ?? 0, page }
}

export async function requestDetail(id: string) {
  const db = getDb()
  const [row] = await db
    .select({ r: reservations, vehicle: { id: vehicles.id, name: vehicles.name, slug: vehicles.slug } })
    .from(reservations)
    .innerJoin(vehicles, eq(vehicles.id, reservations.vehicleId))
    .where(eq(reservations.id, id))
  if (!row) return null
  const [events, notes] = await Promise.all([
    db
      .select({
        id: reservationEvents.id,
        kind: reservationEvents.kind,
        fromStatus: reservationEvents.fromStatus,
        toStatus: reservationEvents.toStatus,
        data: reservationEvents.data,
        createdAt: reservationEvents.createdAt,
        actor: users.name,
      })
      .from(reservationEvents)
      .leftJoin(users, eq(users.id, reservationEvents.actorId))
      .where(eq(reservationEvents.reservationId, id))
      .orderBy(desc(reservationEvents.createdAt)),
    db
      .select({ id: reservationNotes.id, body: reservationNotes.body, createdAt: reservationNotes.createdAt, author: users.name })
      .from(reservationNotes)
      .leftJoin(users, eq(users.id, reservationNotes.authorId))
      .where(eq(reservationNotes.reservationId, id))
      .orderBy(desc(reservationNotes.createdAt)),
  ])
  return { ...row, events, notes }
}

/* ───────────── Kalender ───────────── */

export async function planningInRange(start: Date, end: Date, vehicleId?: string) {
  const db = getDb()
  const resWhere = [lt(reservations.startAt, end), gt(reservations.endAt, start), ne(reservations.status, 'afgewezen'), ne(reservations.status, 'geannuleerd')]
  const blockWhere = [lt(availabilityBlocks.startAt, end), gt(availabilityBlocks.endAt, start)]
  if (vehicleId) {
    resWhere.push(eq(reservations.vehicleId, vehicleId))
    blockWhere.push(eq(availabilityBlocks.vehicleId, vehicleId))
  }
  const [res, blocks] = await Promise.all([
    db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        status: reservations.status,
        optionExpiresAt: reservations.optionExpiresAt,
        start: reservations.startAt,
        end: reservations.endAt,
        customerName: reservations.customerName,
        vehicleId: reservations.vehicleId,
      })
      .from(reservations)
      .where(and(...resWhere))
      .orderBy(asc(reservations.startAt)),
    db
      .select({
        id: availabilityBlocks.id,
        kind: availabilityBlocks.kind,
        reason: availabilityBlocks.reason,
        start: availabilityBlocks.startAt,
        end: availabilityBlocks.endAt,
        vehicleId: availabilityBlocks.vehicleId,
      })
      .from(availabilityBlocks)
      .where(and(...blockWhere))
      .orderBy(asc(availabilityBlocks.startAt)),
  ])
  return { reservations: res, blocks }
}

/* ───────────── Geschiedenis ───────────── */

export async function auditEntries(f: { type?: string; gebruiker?: string; pagina?: number }) {
  const db = getDb()
  const where: SQL[] = []
  if (f.type) where.push(eq(auditLog.entityType, f.type))
  if (f.gebruiker) where.push(eq(auditLog.actorId, f.gebruiker))
  const page = Math.max(1, f.pagina ?? 1)
  const condition = where.length ? and(...where) : undefined
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        summary: auditLog.summary,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
        actor: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(condition)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ n: count() }).from(auditLog).where(condition),
  ])
  return { rows, total: total?.n ?? 0, page }
}
