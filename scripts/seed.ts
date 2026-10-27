/**
 * Reproduceerbare seed.
 *
 *   pnpm db:seed               vier auto’s, foto’s, inhoud, FAQ en pagina’s (idempotent)
 *   pnpm db:seed --demo        voegt duidelijk gemarkeerde voorbeeldaanvragen toe
 *   pnpm db:seed --reset --yes leegt eerst alle inhoud- en planningsdata (niet in productie)
 *
 * Een eigenaar-account wordt alleen aangemaakt als SEED_OWNER_EMAIL en
 * SEED_OWNER_PASSWORD zijn gezet; gebruik anders `pnpm user:create`.
 */
import { eq, sql } from 'drizzle-orm'
import { localToUtc, toLocalInputValues } from '../src/domain/time'
import { generateReference } from '../src/lib/reference'
import { createUser } from '../src/server/auth/users'
import { closeDb, getDb } from '../src/server/db/client'
import { availabilityBlocks, reservationEvents, reservations } from '../src/server/db/schema'
import { loadEnv } from './env'
import { seedContent } from './seed-content'

async function main() {
  loadEnv()
  const args = new Set(process.argv.slice(2))
  const db = getDb()

  if (args.has('--reset')) {
    if (!args.has('--yes')) throw new Error('Gebruik --reset samen met --yes om te bevestigen.')
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET !== '1') {
      throw new Error('Reset geweigerd in productie.')
    }
    await db.execute(sql`TRUNCATE reservation_notes, reservation_events, reservations, availability_blocks,
      promotion_vehicles, promotions, vehicle_verifications, media, vehicles, faqs, pages, site_settings,
      revisions, audit_log, rate_limits RESTART IDENTITY CASCADE`)
    console.log('Bestaande inhoud en planning verwijderd.')
  }

  const vehicleIds = await seedContent(db)

  // Optioneel eigenaar-account uit omgevingsvariabelen (nooit hardcoded).
  const ownerEmail = process.env.SEED_OWNER_EMAIL
  const ownerPassword = process.env.SEED_OWNER_PASSWORD
  if (ownerEmail && ownerPassword) {
    const result = await createUser(db, {
      email: ownerEmail,
      name: process.env.SEED_OWNER_NAME || 'Eigenaar',
      role: 'eigenaar',
      password: ownerPassword,
      mustChangePassword: false,
      actorId: null,
    })
    console.log(result.created ? `Eigenaar-account aangemaakt: ${ownerEmail}` : `Account ${ownerEmail} bestaat al.`)
  } else {
    console.log('Geen eigenaar-account aangemaakt. Gebruik: pnpm user:create --email … --name … --role eigenaar')
  }

  if (args.has('--demo')) await seedDemo(vehicleIds)

  console.log('Seed voltooid.')
}

/** Voorbeeldaanvragen voor een lokale demonstratie. Duidelijk gemarkeerd. */
async function seedDemo(vehicleIds: Map<string, string>) {
  const db = getDb()
  const [already] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.dedupeKey, 'demo'))
  if (already) {
    console.log('Demo-aanvragen bestaan al.')
    return
  }
  const today = toLocalInputValues(new Date()).date
  const at = (days: number, time: string) => {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number]
    const date = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
    const r = localToUtc(date, time)
    if (!r.ok) throw new Error('demo-datum')
    return r.instant
  }
  const rows = [
    { v: 'rs3', s: at(3, '10:00'), e: at(5, '18:00'), status: 'nieuw' as const, name: 'Demo – Sam Jansen', option: null },
    { v: 'sq8', s: at(9, '09:00'), e: at(11, '21:00'), status: 'bevestigd' as const, name: 'Demo – Noor Bakker', option: null },
    { v: 'rsq3', s: at(6, '12:00'), e: at(7, '12:00'), status: 'in_behandeling' as const, name: 'Demo – Yusuf Demir', option: at(2, '12:00') },
    { v: 'sq5', s: at(14, '10:00'), e: at(17, '10:00'), status: 'wacht_op_klant' as const, name: 'Demo – Eva de Wit', option: null },
    { v: 'sq8', s: at(10, '10:00'), e: at(10, '20:00'), status: 'nieuw' as const, name: 'Demo – Lars Visser', option: null },
  ]
  for (const r of rows) {
    const [row] = await db
      .insert(reservations)
      .values({
        reference: generateReference(),
        vehicleId: vehicleIds.get(r.v)!,
        startAt: r.s,
        endAt: r.e,
        status: r.status,
        optionExpiresAt: r.option,
        customerName: r.name,
        customerPhone: '0600000000',
        customerMessage: 'Voorbeeldaanvraag (demonstratiedata).',
        source: 'handmatig',
        dedupeKey: 'demo',
        confirmedAt: r.status === 'bevestigd' ? new Date() : null,
      })
      .returning({ id: reservations.id })
    await db.insert(reservationEvents).values({ reservationId: row!.id, kind: 'aangemaakt', toStatus: r.status, data: { demo: true } })
  }
  await db.insert(availabilityBlocks).values({
    vehicleId: vehicleIds.get('rs3')!,
    kind: 'onderhoud',
    startAt: at(12, '08:00'),
    endAt: at(12, '17:00'),
    reason: 'Demo – onderhoudsbeurt',
  })
  console.log('Demo-aanvragen toegevoegd (herkenbaar aan “Demo –”).')
}

main()
  .catch((err) => {
    console.error('Seed mislukt:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
