import { and, count, eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { saveSetting } from '@/server/content/settings'
import { closeDb, getDb } from '@/server/db/client'
import { media, pages, sessions, users, vehicles, vehicleVerifications } from '@/server/db/schema'
import { publicationReadiness } from '@/server/publication/readiness'
import { getPublishedVehicles } from '@/server/public/queries'
import { changeRole, inviteUser, resetUserPassword, setUserActive, UserAdminError } from '@/server/users/service'
import { setStatus, setVerification, updatePricing, VehicleError } from '@/server/vehicles/service'

const db = () => getDb()

async function makeUser(email: string, role: 'eigenaar' | 'medewerker' | 'redacteur', active = true) {
  const [u] = await db()
    .insert(users)
    .values({ email, name: email.split('@')[0]!, role, active, passwordHash: await hashPassword('Een-lang-test-wachtwoord-1') })
    .returning()
  return u!
}

async function makeSession(userId: string) {
  await db()
    .insert(sessions)
    .values({ id: `sessie-${userId}-${Math.random()}`, userId, expiresAt: new Date(Date.now() + 86_400_000) })
}

async function sessionCount(userId: string) {
  const [row] = await db().select({ n: count() }).from(sessions).where(eq(sessions.userId, userId))
  return row?.n ?? 0
}

/** Eén wijziging slaagt; de andere wordt netjes geweigerd (geen deadlock of databasefout). */
function expectOneCleanRefusal(results: PromiseSettledResult<void>[]) {
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  expect(rejected).toHaveLength(1)
  expect(rejected[0]!.reason).toBeInstanceOf(UserAdminError)
}

async function activeOwners() {
  const [row] = await db()
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, 'eigenaar'), eq(users.active, true)))
  return row?.n ?? 0
}

async function makeVehicle(slug: string, opts: { photo?: boolean; status?: 'concept' | 'gepubliceerd' } = {}) {
  const [v] = await db()
    .insert(vehicles)
    .values({ slug, name: `Test ${slug}`, model: slug, tagline: 'Een korte omschrijving.', status: opts.status ?? 'concept', dayRateCents: 19_900, depositCents: 100_000 })
    .returning()
  if (opts.photo) {
    await db().insert(media).values({
      vehicleId: v!.id,
      originalKey: `originals/${slug}.jpg`,
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      bytes: 1000,
      sha256: slug,
      alt: `Foto van ${slug}`,
      isPublic: true,
    })
  }
  return v!
}

beforeAll(async () => {
  await migrate(db(), { migrationsFolder: './drizzle' })
})

beforeEach(async () => {
  await db().execute(
    sql`TRUNCATE sessions, audit_log, revisions, site_settings, pages, faqs, media, vehicle_verifications, reservations, vehicles, users RESTART IDENTITY CASCADE`,
  )
})

afterAll(async () => {
  await closeDb()
})

describe('gebruikersbeheer', () => {
  it('maakt een account met een tijdelijk wachtwoord dat bij de eerste login gewijzigd moet worden', async () => {
    const owner = await makeUser('eigenaar@test.nl', 'eigenaar')
    const { user, temporaryPassword } = await inviteUser(db(), { email: 'Nieuw@Test.nl', name: 'Nieuwe collega', role: 'redacteur' }, owner.id)
    expect(user.email).toBe('nieuw@test.nl')
    expect(user.mustChangePassword).toBe(true)
    expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{6}-[A-Za-z2-9]{6}-[A-Za-z2-9]{6}$/)
    const [row] = await db().select().from(users).where(eq(users.id, user.id))
    expect(await verifyPassword(row!.passwordHash, temporaryPassword)).toBe(true)
    await expect(inviteUser(db(), { email: 'NIEUW@test.nl', name: 'Dubbel', role: 'medewerker' }, owner.id)).rejects.toThrow(UserAdminError)
  })

  it('weigert accountbeheer door iemand die geen actieve eigenaar is', async () => {
    const staff = await makeUser('medewerker@test.nl', 'medewerker')
    const other = await makeUser('redacteur@test.nl', 'redacteur')
    await expect(inviteUser(db(), { email: 'x@test.nl', name: 'X', role: 'eigenaar' }, staff.id)).rejects.toThrow(UserAdminError)
    await expect(changeRole(db(), other.id, 'eigenaar', staff.id)).rejects.toThrow(UserAdminError)
    const formerOwner = await makeUser('oud@test.nl', 'eigenaar', false)
    await expect(setUserActive(db(), other.id, false, formerOwner.id)).rejects.toThrow(UserAdminError)
    const [row] = await db().select().from(users).where(eq(users.id, other.id))
    expect(row!.role).toBe('redacteur')
    expect(row!.active).toBe(true)
  })

  it('je kunt je eigen rol, status en wachtwoord niet via gebruikersbeheer wijzigen', async () => {
    const owner = await makeUser('eigenaar@test.nl', 'eigenaar')
    await expect(changeRole(db(), owner.id, 'medewerker', owner.id)).rejects.toThrow(/eigen rol/)
    await expect(setUserActive(db(), owner.id, false, owner.id)).rejects.toThrow(/eigen account/)
    await expect(resetUserPassword(db(), owner.id, owner.id)).rejects.toThrow(/Mijn account/)
  })

  it('deactiveren en een nieuw tijdelijk wachtwoord beëindigen alle sessies', async () => {
    const owner = await makeUser('eigenaar@test.nl', 'eigenaar')
    const staff = await makeUser('medewerker@test.nl', 'medewerker')
    await makeSession(staff.id)
    await makeSession(staff.id)
    const temp = await resetUserPassword(db(), staff.id, owner.id)
    expect(await sessionCount(staff.id)).toBe(0)
    const [afterReset] = await db().select().from(users).where(eq(users.id, staff.id))
    expect(afterReset!.mustChangePassword).toBe(true)
    expect(await verifyPassword(afterReset!.passwordHash, temp)).toBe(true)
    await makeSession(staff.id)
    await setUserActive(db(), staff.id, false, owner.id)
    expect(await sessionCount(staff.id)).toBe(0)
  })

  it('twee eigenaren die elkaar tegelijk degraderen laten altijd één eigenaar over', async () => {
    for (let round = 0; round < 5; round++) {
      await db().execute(sql`TRUNCATE sessions, audit_log, users RESTART IDENTITY CASCADE`)
      const a = await makeUser('a@test.nl', 'eigenaar')
      const b = await makeUser('b@test.nl', 'eigenaar')
      const results = await Promise.allSettled([changeRole(db(), b.id, 'medewerker', a.id), changeRole(db(), a.id, 'medewerker', b.id)])
      expectOneCleanRefusal(results)
      expect(await activeOwners()).toBe(1)
    }
  })

  it('tegelijk deactiveren laat ook altijd één actieve eigenaar over', async () => {
    const a = await makeUser('a@test.nl', 'eigenaar')
    const b = await makeUser('b@test.nl', 'eigenaar')
    const results = await Promise.allSettled([setUserActive(db(), b.id, false, a.id), setUserActive(db(), a.id, false, b.id)])
    expectOneCleanRefusal(results)
    expect(await activeOwners()).toBe(1)
  })
})

describe('brongegevens en publicatie', () => {
  it('een gewijzigde dagprijs verliest de bevestiging, tenzij in dezelfde opslag opnieuw bevestigd', async () => {
    const v = await makeVehicle('rs3')
    await setVerification(v.id, 'dagprijs', true, null)
    const base = { weekendRateCents: null, weekRateCents: null, depositCents: 100_000, extraCosts: [] }
    await updatePricing(v.id, { ...base, dayRateCents: 21_900 }, { actor: null, confirmDay: false, confirmDeposit: false, confirmRules: false })
    const afterChange = await db().select().from(vehicleVerifications).where(eq(vehicleVerifications.vehicleId, v.id))
    expect(afterChange.map((x) => x.field)).not.toContain('dagprijs')
    await updatePricing(v.id, { ...base, dayRateCents: 22_900 }, { actor: null, confirmDay: true, confirmDeposit: false, confirmRules: false })
    const confirmed = await db().select().from(vehicleVerifications).where(eq(vehicleVerifications.vehicleId, v.id))
    expect(confirmed.map((x) => x.field)).toContain('dagprijs')
  })

  it('publiceren vereist een publieke foto', async () => {
    const v = await makeVehicle('sq5')
    await expect(setStatus(v.id, 'gepubliceerd', null)).rejects.toThrow(VehicleError)
    const w = await makeVehicle('sq8', { photo: true })
    await expect(setStatus(w.id, 'gepubliceerd', null)).resolves.toMatchObject({ status: 'gepubliceerd' })
  })

  it('live gaan kan pas na fotorechten, logo, contact, teksten en een gepubliceerde privacyverklaring', async () => {
    const v = await makeVehicle('rsq3', { photo: true, status: 'gepubliceerd' })
    let r = await publicationReadiness()
    expect(r.canGoLive).toBe(false)
    expect(r.blockers.filter((b) => !b.ok).map((b) => b.id)).toEqual([`fotos-${v.id}`, 'check-logo', 'check-contact', 'check-teksten', 'privacy'])

    await setVerification(v.id, 'fotos', true, null)
    const at = new Date().toISOString()
    await saveSetting(db(), 'siteChecks', { logo: { confirmed: true, by: 'Test', at }, contact: { confirmed: true, by: 'Test', at }, teksten: { confirmed: true, by: 'Test', at } }, null, 'test')
    await db().insert(pages).values({ slug: 'privacy', title: 'Privacyverklaring', body: 'Volledige tekst.', status: 'gepubliceerd' })
    r = await publicationReadiness()
    expect(r.canGoLive).toBe(true)
  })

  it('op de live site verdwijnen onbevestigde prijzen en auto’s zonder bevestigde fotorechten', async () => {
    const shown = await makeVehicle('zichtbaar', { photo: true, status: 'gepubliceerd' })
    const hidden = await makeVehicle('verborgen', { photo: true, status: 'gepubliceerd' })
    await setVerification(shown.id, 'fotos', true, null)

    // Concept: alles zichtbaar, prijs als onbevestigde indicatie.
    let list = await getPublishedVehicles()
    expect(list.map((v) => v.slug).sort()).toEqual(['verborgen', 'zichtbaar'])
    expect(list.find((v) => v.slug === 'zichtbaar')!.price).toMatchObject({ kind: 'dagprijs', confirmed: false })

    await saveSetting(db(), 'publication', { mode: 'live', indexable: false }, null, 'test')
    list = await getPublishedVehicles()
    expect(list.map((v) => v.slug)).toEqual(['zichtbaar'])
    const live = list[0]!
    expect(live.price).toEqual({ kind: 'verborgen' })
    expect(live.deposit).toEqual({ kind: 'verborgen' })
    expect(live.specs).toBeNull()
    expect(live.terms).toBeNull()
    expect(hidden.id).not.toBe(live.id)

    await setVerification(shown.id, 'dagprijs', true, null)
    list = await getPublishedVehicles()
    expect(list[0]!.price).toMatchObject({ kind: 'dagprijs', dayRateCents: 19_900, confirmed: true })
  })
})
