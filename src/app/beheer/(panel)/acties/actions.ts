'use server'

import { and, eq, inArray, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { checkPromotion } from '@/domain/pricing'
import { localToUtc } from '@/domain/time'
import { parseEuroToCents } from '@/lib/format'
import { diff, recordAudit } from '@/server/audit'
import { actionUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { promotions, promotionVehicles, vehicles } from '@/server/db/schema'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function savePromotionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('acties:beheren')
  if (!user) return fail('Alleen de eigenaar beheert acties.')
  const id = str(fd, 'promotionId') || undefined
  const title = str(fd, 'title')
  const description = str(fd, 'description')
  const kind = str(fd, 'kind') === 'percentage' ? 'percentage' : 'vaste_dagprijs'
  const status = str(fd, 'status') === 'gepubliceerd' ? 'gepubliceerd' : 'concept'
  const vehicleIds = fd.getAll('vehicleIds').map(String).filter(Boolean)
  const errors: Record<string, string> = {}
  if (title.length < 3 || title.length > 60) errors.title = 'Gebruik 3 tot 60 tekens.'
  if (description.length > 160) errors.description = 'Maximaal 160 tekens.'
  const value = kind === 'percentage' ? Number(str(fd, 'value').replace('%', '').replace(',', '.')) : parseEuroToCents(str(fd, 'value'))
  if (value === null || !Number.isFinite(value)) errors.value = kind === 'percentage' ? 'Vul een percentage in.' : 'Vul een actieprijs per dag in.'
  const s = localToUtc(str(fd, 'startDate'), str(fd, 'startTime') || '00:00')
  const e = localToUtc(str(fd, 'endDate'), str(fd, 'endTime') || '23:59')
  if (!s.ok) errors.startDate = 'Vul een geldige begindatum in.'
  if (!e.ok) errors.endDate = 'Vul een geldige einddatum in.'
  if (Object.keys(errors).length || !s.ok || !e.ok || value === null) return fail('Controleer de gemarkeerde velden.', errors)

  const db = getDb()
  const vehicleRows = vehicleIds.length
    ? await db.select({ id: vehicles.id, day: vehicles.dayRateCents }).from(vehicles).where(inArray(vehicles.id, vehicleIds))
    : []
  const otherLive = await db
    .select({ id: promotions.id, title: promotions.title, startsAt: promotions.startsAt, endsAt: promotions.endsAt, vehicleId: promotionVehicles.vehicleId })
    .from(promotions)
    .innerJoin(promotionVehicles, eq(promotionVehicles.promotionId, promotions.id))
    .where(and(eq(promotions.status, 'gepubliceerd'), id ? ne(promotions.id, id) : undefined))
  const grouped = new Map<string, { id: string; title: string; startsAt: Date; endsAt: Date; vehicleIds: string[] }>()
  for (const r of otherLive) {
    const g = grouped.get(r.id) ?? { id: r.id, title: r.title, startsAt: r.startsAt, endsAt: r.endsAt, vehicleIds: [] }
    g.vehicleIds.push(r.vehicleId)
    grouped.set(r.id, g)
  }
  const issues = checkPromotion(
    { id, kind, value: Math.round(value), startsAt: s.instant, endsAt: e.instant, vehicleIds },
    { dayRates: new Map(vehicleRows.map((v) => [v.id, v.day])), otherLivePromotions: status === 'gepubliceerd' ? [...grouped.values()] : [] },
  )
  if (issues.length) {
    const errs: Record<string, string> = {}
    for (const i of issues) errs[i.field === 'period' ? 'endDate' : i.field === 'vehicles' ? 'vehicleIds' : 'value'] ??= i.message
    return fail(issues.map((i) => i.message).join(' '), errs)
  }

  await db.transaction(async (tx) => {
    const values = { title, description, kind: kind as 'percentage' | 'vaste_dagprijs', value: Math.round(value), startsAt: s.instant, endsAt: e.instant, status: status as 'concept' | 'gepubliceerd', updatedBy: user.id, updatedAt: new Date() }
    let promoId = id
    if (id) {
      const [current] = await tx.select().from(promotions).where(eq(promotions.id, id))
      if (!current) throw new Error('Actie niet gevonden')
      await tx.update(promotions).set(values).where(eq(promotions.id, id))
      await recordAudit(tx, {
        actorId: user.id,
        action: 'actie.bijgewerkt',
        entityType: 'actie',
        entityId: id,
        summary: `Actie “${title}” bijgewerkt`,
        changes: diff(current as unknown as Record<string, unknown>, values as unknown as Record<string, unknown>, ['title', 'kind', 'value', 'startsAt', 'endsAt', 'status']),
      })
    } else {
      const [row] = await tx.insert(promotions).values({ ...values, createdBy: user.id }).returning({ id: promotions.id })
      promoId = row!.id
      await recordAudit(tx, { actorId: user.id, action: 'actie.aangemaakt', entityType: 'actie', entityId: promoId, summary: `Actie “${title}” aangemaakt (${status === 'gepubliceerd' ? 'live' : 'concept'})` })
    }
    await tx.delete(promotionVehicles).where(eq(promotionVehicles.promotionId, promoId!))
    if (vehicleIds.length) await tx.insert(promotionVehicles).values(vehicleIds.map((vehicleId) => ({ promotionId: promoId!, vehicleId })))
  })
  revalidatePath('/beheer', 'layout')
  revalidatePath('/', 'layout')
  return done(id ? 'Actie opgeslagen.' : 'Actie aangemaakt.')
}

export async function deletePromotionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('acties:beheren')
  if (!user) return fail('Alleen de eigenaar beheert acties.')
  const id = str(fd, 'promotionId')
  const db = getDb()
  const [row] = await db.select({ title: promotions.title }).from(promotions).where(eq(promotions.id, id))
  if (!row) return fail('Actie niet gevonden.')
  await db.delete(promotions).where(eq(promotions.id, id))
  await recordAudit(db, { actorId: user.id, action: 'actie.verwijderd', entityType: 'actie', entityId: id, summary: `Actie “${row.title}” verwijderd` })
  revalidatePath('/beheer', 'layout')
  revalidatePath('/', 'layout')
  return done('Actie verwijderd.')
}
