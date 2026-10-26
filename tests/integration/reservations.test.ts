import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '@/server/db/client'
import { reservationNotes, reservations, vehicles } from '@/server/db/schema'
import {
  changeStatus,
  ConflictError,
  createBlock,
  createManual,
  createWebsiteRequest,
  setOption,
  TransitionError,
  updatePeriod,
} from '@/server/reservations/service'

const d = (iso: string) => new Date(iso)
const NOW = d('2026-11-01T12:00:00Z')
const actor = null
let vehicleId = ''
let otherVehicleId = ''

async function request(start: string, end: string, phone = '0612345678', vid = vehicleId) {
  const r = await createWebsiteRequest({ vehicleId: vid, start: d(start), end: d(end), name: 'Test', phone, email: null, message: null })
  return r.id
}

beforeAll(async () => {
  const db = getDb()
  await migrate(db, { migrationsFolder: './drizzle' })
})

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`TRUNCATE reservation_notes, reservation_events, reservations, availability_blocks, audit_log, vehicles RESTART IDENTITY CASCADE`)
  const [a] = await db.insert(vehicles).values({ slug: 'test-a', name: 'Test A', model: 'A', status: 'gepubliceerd' }).returning()
  const [b] = await db.insert(vehicles).values({ slug: 'test-b', name: 'Test B', model: 'B', status: 'gepubliceerd' }).returning()
  vehicleId = a!.id
  otherVehicleId = b!.id
})

afterAll(async () => {
  await closeDb()
})

describe('aanvragen', () => {
  it('slaat een website-aanvraag op als “nieuw” en herkent een herhaalde verzending', async () => {
    const first = await createWebsiteRequest({ vehicleId, start: d('2026-11-07T09:00:00Z'), end: d('2026-11-08T17:00:00Z'), name: 'Sam', phone: '06 12345678', email: null, message: null })
    const again = await createWebsiteRequest({ vehicleId, start: d('2026-11-07T09:00:00Z'), end: d('2026-11-08T17:00:00Z'), name: 'Sam', phone: '0612345678', email: null, message: null })
    expect(first.kind).toBe('created')
    expect(again).toMatchObject({ kind: 'duplicate', reference: first.reference })
    const rows = await getDb().select().from(reservations)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('nieuw')
  })

  it('een open aanvraag blokkeert niet: twee aanvragen voor dezelfde periode kunnen naast elkaar bestaan', async () => {
    await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0611111111')
    await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0622222222')
    expect(await getDb().select().from(reservations)).toHaveLength(2)
  })
})

describe('bevestigen en overlap', () => {
  it('bevestigt een vrije periode en weigert een overlappende tweede bevestiging', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0611111111')
    const b = await request('2026-11-08T09:00:00Z', '2026-11-09T17:00:00Z', '0622222222')
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })).rejects.toBeInstanceOf(ConflictError)
  })

  it('aansluitende perioden zijn geen overlap', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T09:00:00Z', '0611111111')
    const b = await request('2026-11-08T09:00:00Z', '2026-11-09T09:00:00Z', '0622222222')
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })).resolves.toMatchObject({ status: 'bevestigd' })
  })

  it('overlap op een andere auto is geen probleem', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0611111111')
    const b = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0622222222', otherVehicleId)
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })).resolves.toBeTruthy()
  })

  it('voorkomt dubbele boekingen wanneer twee beheerders tegelijk bevestigen', async () => {
    const ids = await Promise.all(
      Array.from({ length: 6 }, (_, i) => request('2026-11-07T09:00:00Z', `2026-11-08T1${i}:00:00Z`, `06${String(i).repeat(8)}`)),
    )
    const results = await Promise.allSettled(ids.map((id) => changeStatus({ reservationId: id, to: 'bevestigd', actor, now: NOW })))
    const ok = results.filter((r) => r.status === 'fulfilled')
    const conflicts = results.filter((r) => r.status === 'rejected' && r.reason instanceof ConflictError)
    expect(ok).toHaveLength(1)
    expect(conflicts).toHaveLength(5)
    const confirmed = await getDb().execute(sql`SELECT count(*)::int AS n FROM reservations WHERE status = 'bevestigd'`)
    expect(confirmed.rows[0]).toEqual({ n: 1 })
  })

  it('de database weigert overlappende bevestigde reserveringen ook buiten de applicatie om', async () => {
    const db = getDb()
    await db.insert(reservations).values({ reference: 'GG-AAAAAA', vehicleId, startAt: d('2026-11-07T09:00:00Z'), endAt: d('2026-11-08T09:00:00Z'), status: 'bevestigd', customerName: 'X', customerPhone: '0600000000' })
    await expect(
      db.insert(reservations).values({ reference: 'GG-BBBBBB', vehicleId, startAt: d('2026-11-07T20:00:00Z'), endAt: d('2026-11-09T09:00:00Z'), status: 'bevestigd', customerName: 'Y', customerPhone: '0600000001' }),
    ).rejects.toMatchObject({ cause: { code: '23P01' } })
  })

  it('periode van een bevestigde reservering wijzigen controleert op overlap', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T09:00:00Z', '0611111111')
    const b = await request('2026-11-10T09:00:00Z', '2026-11-11T09:00:00Z', '0622222222')
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })
    await expect(updatePeriod({ reservationId: b, start: d('2026-11-07T20:00:00Z'), end: d('2026-11-09T09:00:00Z'), actor, now: NOW })).rejects.toBeInstanceOf(ConflictError)
    await expect(updatePeriod({ reservationId: b, start: d('2026-11-08T09:00:00Z'), end: d('2026-11-09T09:00:00Z'), actor, now: NOW })).resolves.toBeTruthy()
  })
})

describe('tijdelijke opties', () => {
  it('een actieve optie houdt de auto vast; na de vervaldatum niet meer', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0611111111')
    const b = await request('2026-11-08T09:00:00Z', '2026-11-09T17:00:00Z', '0622222222')
    await setOption({ reservationId: a, expiresAt: d('2026-11-03T12:00:00Z'), actor, now: NOW })
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })).rejects.toBeInstanceOf(ConflictError)
    // Na het verlopen van de optie kan B wel bevestigd worden.
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: d('2026-11-04T12:00:00Z') })).resolves.toBeTruthy()
  })

  it('een optie kan niet in het verleden vervallen en niet op een gesloten aanvraag', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z')
    await expect(setOption({ reservationId: a, expiresAt: d('2026-10-31T12:00:00Z'), actor, now: NOW })).rejects.toBeInstanceOf(TransitionError)
    await changeStatus({ reservationId: a, to: 'afgewezen', actor, now: NOW })
    await expect(setOption({ reservationId: a, expiresAt: d('2026-11-03T12:00:00Z'), actor, now: NOW })).rejects.toBeInstanceOf(TransitionError)
  })

  it('bevestigen ruimt de optie op', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z')
    await setOption({ reservationId: a, expiresAt: d('2026-11-03T12:00:00Z'), actor, now: NOW })
    const confirmed = await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    expect(confirmed.optionExpiresAt).toBeNull()
  })
})

describe('blokkades', () => {
  it('weigert een blokkade over een bevestigde reservering en blokkeert bevestigen erover', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z', '0611111111')
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await expect(
      createBlock({ vehicleId, kind: 'onderhoud', start: d('2026-11-08T08:00:00Z'), end: d('2026-11-08T16:00:00Z'), reason: 'APK', actor, now: NOW }),
    ).rejects.toBeInstanceOf(ConflictError)
    await createBlock({ vehicleId, kind: 'blokkade', start: d('2026-11-12T08:00:00Z'), end: d('2026-11-13T16:00:00Z'), reason: 'Eigen gebruik', actor, now: NOW })
    const b = await request('2026-11-13T09:00:00Z', '2026-11-14T09:00:00Z', '0622222222')
    await expect(changeStatus({ reservationId: b, to: 'bevestigd', actor, now: NOW })).rejects.toBeInstanceOf(ConflictError)
  })

  it('handmatig een bevestigde reservering toevoegen controleert ook op overlap', async () => {
    await createBlock({ vehicleId, kind: 'onderhoud', start: d('2026-11-12T08:00:00Z'), end: d('2026-11-12T16:00:00Z'), reason: '', actor, now: NOW })
    await expect(
      createManual({ vehicleId, start: d('2026-11-12T10:00:00Z'), end: d('2026-11-13T10:00:00Z'), name: 'Klant', phone: '0612345678', email: null, message: null, source: 'telefoon', status: 'bevestigd', optionExpiresAt: null, actor, now: NOW }),
    ).rejects.toBeInstanceOf(ConflictError)
    await expect(
      createManual({ vehicleId, start: d('2026-11-12T10:00:00Z'), end: d('2026-11-13T10:00:00Z'), name: 'Klant', phone: '0612345678', email: null, message: null, source: 'telefoon', status: 'nieuw', optionExpiresAt: null, actor, now: NOW }),
    ).resolves.toMatchObject({ status: 'nieuw' })
  })
})

describe('statusovergangen', () => {
  it('weigert ongeldige overgangen en registreert de historie', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z')
    await changeStatus({ reservationId: a, to: 'in_behandeling', actor, now: NOW })
    await changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })
    await changeStatus({ reservationId: a, to: 'afgerond', actor, now: NOW })
    await expect(changeStatus({ reservationId: a, to: 'bevestigd', actor, now: NOW })).rejects.toBeInstanceOf(TransitionError)
    const events = await getDb().execute(sql`SELECT kind, from_status, to_status FROM reservation_events WHERE reservation_id = ${a} ORDER BY created_at`)
    expect(events.rows.map((e) => `${e.kind}:${e.from_status ?? ''}>${e.to_status ?? ''}`)).toEqual([
      'aangemaakt:>nieuw',
      'status:nieuw>in_behandeling',
      'status:in_behandeling>bevestigd',
      'status:bevestigd>afgerond',
    ])
  })
})

describe('privacy', () => {
  it('interne notities komen niet in de publieke gegevens', async () => {
    const a = await request('2026-11-07T09:00:00Z', '2026-11-08T17:00:00Z')
    await getDb().insert(reservationNotes).values({ reservationId: a, body: 'GEHEIME-NOTITIE-123' })
    const { getPublishedVehicles } = await import('@/server/public/queries')
    const publicData = JSON.stringify(await getPublishedVehicles())
    expect(publicData).not.toContain('GEHEIME-NOTITIE-123')
    expect(publicData).not.toContain('sourceNote')
    expect(publicData).not.toContain('customerPhone')
  })
})
