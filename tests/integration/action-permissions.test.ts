/**
 * Rechten worden in de Server Actions zelf gecontroleerd, niet alleen door
 * knoppen te verbergen. Deze tests roepen de acties rechtstreeks aan met een
 * echte sessie per rol (alleen de cookie-API van Next is nagebootst) en
 * controleren dat er bij een weigering niets in de database verandert.
 */
import { createHash, randomBytes } from 'node:crypto'
import { count, eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let currentToken: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (currentToken ? { name, value: currentToken } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))

const { getDb, closeDb } = await import('@/server/db/client')
const schema = await import('@/server/db/schema')
const { hashPassword } = await import('@/server/auth/password')
const wagenpark = await import('@/app/beheer/(panel)/wagenpark/actions')
const publicatie = await import('@/app/beheer/(panel)/publicatie/actions')
const inhoud = await import('@/app/beheer/(panel)/inhoud/actions')
const aanvragen = await import('@/app/beheer/(panel)/aanvragen/actions')
const kalender = await import('@/app/beheer/(panel)/kalender/actions')
const gebruikers = await import('@/app/beheer/(panel)/gebruikers/actions')
const acties = await import('@/app/beheer/(panel)/acties/actions')
const { INITIAL_STATE } = await import('@/components/admin/action-state')

const { users, sessions, vehicles, vehicleVerifications, reservations, availabilityBlocks, siteSettings, promotions } = schema
type Role = 'eigenaar' | 'medewerker' | 'redacteur'
const tokens = {} as Record<Role, string>
let vehicleId = ''
let reservationId = ''

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

function as(role: Role | null) {
  currentToken = role ? tokens[role] : null
}

async function rows(table: typeof users | typeof availabilityBlocks | typeof promotions | typeof vehicleVerifications) {
  const [r] = await getDb().select({ n: count() }).from(table)
  return r?.n ?? 0
}

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: './drizzle' })
})

beforeEach(async () => {
  const db = getDb()
  await db.execute(
    sql`TRUNCATE sessions, audit_log, revisions, site_settings, promotion_vehicles, promotions, availability_blocks, reservation_events, reservation_notes, reservations, vehicle_verifications, media, vehicles, users RESTART IDENTITY CASCADE`,
  )
  for (const role of ['eigenaar', 'medewerker', 'redacteur'] as const) {
    const [u] = await db
      .insert(users)
      .values({ email: `${role}@test.nl`, name: role, role, passwordHash: await hashPassword('Een-lang-test-wachtwoord-1') })
      .returning()
    const token = randomBytes(32).toString('base64url')
    await db.insert(sessions).values({ id: createHash('sha256').update(token).digest('hex'), userId: u!.id, expiresAt: new Date(Date.now() + 86_400_000) })
    tokens[role] = token
  }
  const [v] = await db
    .insert(vehicles)
    .values({ slug: 'test-auto', name: 'Testauto', model: 'Test', tagline: 'Test.', status: 'gepubliceerd', dayRateCents: 40_000, depositCents: 200_000 })
    .returning()
  vehicleId = v!.id
  const [r] = await db
    .insert(reservations)
    .values({
      reference: 'GG-TEST01',
      vehicleId,
      startAt: new Date('2027-03-01T09:00:00Z'),
      endAt: new Date('2027-03-03T09:00:00Z'),
      customerName: 'Klant',
      customerPhone: '0612345678',
      status: 'nieuw',
      source: 'website',
    })
    .returning()
  reservationId = r!.id
})

afterAll(async () => {
  currentToken = null
  await closeDb()
})

describe('server-side rechten in Server Actions', () => {
  it('prijzen wijzigen: alleen de eigenaar', async () => {
    const fd = () => form({ vehicleId, dayRate: '999', deposit: '2000', weekendRate: '', weekRate: '' })
    for (const role of ['redacteur', 'medewerker', null] as const) {
      as(role)
      const res = await wagenpark.updatePricingAction(INITIAL_STATE, fd())
      expect(res.ok, `${role}`).toBe(false)
    }
    const [unchanged] = await getDb().select().from(vehicles).where(eq(vehicles.id, vehicleId))
    expect(unchanged!.dayRateCents).toBe(40_000)

    as('eigenaar')
    const ok = await wagenpark.updatePricingAction(INITIAL_STATE, fd())
    expect(ok.ok).toBe(true)
    const [changed] = await getDb().select().from(vehicles).where(eq(vehicles.id, vehicleId))
    expect(changed!.dayRateCents).toBe(99_900)
  })

  it('brongegevens bevestigen: alleen de eigenaar', async () => {
    for (const role of ['redacteur', 'medewerker'] as const) {
      as(role)
      expect((await wagenpark.setVerificationAction(INITIAL_STATE, form({ vehicleId, veld: 'dagprijs:ja' }))).ok).toBe(false)
    }
    expect(await rows(vehicleVerifications)).toBe(0)
  })

  it('auto verwijderen: niet door een redacteur', async () => {
    as('redacteur')
    expect((await wagenpark.deleteVehicleAction(INITIAL_STATE, form({ vehicleId, bevestig: 'ja' }))).ok).toBe(false)
    const [still] = await getDb().select().from(vehicles).where(eq(vehicles.id, vehicleId))
    expect(still).toBeDefined()
  })

  it('website live zetten: alleen de eigenaar, en alleen zonder open blokkades', async () => {
    as('redacteur')
    expect((await publicatie.publicationAction(INITIAL_STATE, form({ intent: 'live' }))).ok).toBe(false)
    as('medewerker')
    expect((await publicatie.publicationAction(INITIAL_STATE, form({ intent: 'live' }))).ok).toBe(false)
    as('eigenaar')
    const res = await publicatie.publicationAction(INITIAL_STATE, form({ intent: 'live' }))
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/Nog niet mogelijk/)
    const [setting] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, 'publication'))
    expect(setting).toBeUndefined()
  })

  it('contactgegevens wijzigen: niet door een redacteur, teksten wel', async () => {
    as('redacteur')
    const contact = await inhoud.saveSettingAction(
      INITIAL_STATE,
      form({ key: 'contact', whatsapp: '31600000000', phoneDisplay: '06', instagramUrl: '', instagramHandle: '', city: 'Den Haag', email: '' }),
    )
    expect(contact.ok).toBe(false)
    const [none] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, 'contact'))
    expect(none).toBeUndefined()

    const footer = await inhoud.saveSettingAction(INITIAL_STATE, form({ key: 'footer', tagline: 'Nieuwe regel.', legalNote: 'Opmerking.' }))
    expect(footer.ok).toBe(true)
  })

  it('aanvraagstatus en blokkades: niet door een redacteur', async () => {
    as('redacteur')
    expect((await aanvragen.changeStatusAction(INITIAL_STATE, form({ reservationId, to: 'bevestigd' }))).ok).toBe(false)
    const [r] = await getDb().select().from(reservations).where(eq(reservations.id, reservationId))
    expect(r!.status).toBe('nieuw')
    const block = form({ vehicleId, kind: 'onderhoud', reason: 'x', startDate: '2027-04-01', startTime: '08:00', endDate: '2027-04-01', endTime: '18:00' })
    expect((await kalender.createBlockAction(INITIAL_STATE, block)).ok).toBe(false)
    expect(await rows(availabilityBlocks)).toBe(0)

    as('medewerker')
    expect((await aanvragen.changeStatusAction(INITIAL_STATE, form({ reservationId, to: 'in_behandeling' }))).ok).toBe(true)
  })

  it('gebruikers en acties: alleen de eigenaar', async () => {
    const before = await rows(users)
    for (const role of ['medewerker', 'redacteur'] as const) {
      as(role)
      expect((await gebruikers.inviteUserAction(INITIAL_STATE, form({ email: `nieuw-${role}@test.nl`, name: 'Nieuw', role: 'eigenaar' }))).ok).toBe(false)
      const promo = form({ title: 'Test', kind: 'percentage', value: '10', startDate: '2027-01-01', startTime: '00:00', endDate: '2027-01-31', endTime: '23:59', status: 'concept', vehicleIds: vehicleId })
      expect((await acties.savePromotionAction(INITIAL_STATE, promo)).ok).toBe(false)
    }
    expect(await rows(users)).toBe(before)
    expect(await rows(promotions)).toBe(0)
  })

  it('zonder sessie wordt alles geweigerd', async () => {
    as(null)
    expect((await inhoud.saveSettingAction(INITIAL_STATE, form({ key: 'footer', tagline: 'x', legalNote: 'y' }))).ok).toBe(false)
    expect((await aanvragen.changeStatusAction(INITIAL_STATE, form({ reservationId, to: 'in_behandeling' }))).ok).toBe(false)
    expect((await publicatie.siteCheckAction(INITIAL_STATE, form({ controle: 'logo:ja' }))).ok).toBe(false)
  })
})
