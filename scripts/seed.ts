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
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { DEFAULT_CONTENT } from '../src/domain/content'
import { localToUtc, toLocalInputValues } from '../src/domain/time'
import { generateReference } from '../src/lib/reference'
import { createUser } from '../src/server/auth/users'
import { closeDb, getDb } from '../src/server/db/client'
import {
  availabilityBlocks,
  faqs,
  media,
  pages,
  reservationEvents,
  reservations,
  siteSettings,
  vehicles,
} from '../src/server/db/schema'
import { storeImage } from '../src/server/media/service'
import { ensureDefaultSettings } from '../src/server/content/settings'
import { loadEnv } from './env'
import { SEED_FAQS, SEED_PAGES, SEED_VEHICLES } from './seed-data'

type SourceVehicle = {
  id: string
  naam: string
  dagprijs_eur: number
  borg_eur: number
  minimumleeftijd: number
  kilometers: string
  kentekenland: string
  transmissie: string
  vermogen_pk: number
  koppel_nm: number
  nul_tot_honderd_seconden: number
  bron: string
  status: string
}

type SourcePhoto = { model: string; bestand: string; url: string }

const SOURCE_DIR = join(process.cwd(), 'bronmateriaal')

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

  const source: SourceVehicle[] = JSON.parse(await readFile(join(SOURCE_DIR, 'wagenpark.json'), 'utf8'))
  const photoSources: SourcePhoto[] = JSON.parse(await readFile(join(SOURCE_DIR, 'fotobronnen.json'), 'utf8'))
  if (source.length !== 4) console.warn(`Let op: wagenpark.json bevat ${source.length} records.`)

  const vehicleIds = new Map<string, string>()
  const mediaByFile = new Map<string, string>()

  for (const [index, seed] of SEED_VEHICLES.entries()) {
    const src = source.find((s) => s.id === seed.sourceId)
    if (!src) throw new Error(`Geen brondata voor ${seed.sourceId}`)

    const values = {
      slug: seed.slug,
      name: seed.name,
      brand: 'Audi',
      model: seed.model,
      edition: seed.edition,
      modelYear: seed.modelYear,
      tagline: seed.tagline,
      description: seed.description,
      highlights: seed.highlights,
      status: 'gepubliceerd' as const,
      sortOrder: index,
      featured: seed.sourceId === 'sq8',
      powerHp: src.vermogen_pk,
      torqueNm: src.koppel_nm,
      accelTenths: Math.round(src.nul_tot_honderd_seconden * 10),
      transmission: src.transmissie,
      plateCountry: src.kentekenland,
      minAge: src.minimumleeftijd,
      mileagePolicy: src.kilometers,
      dayRateCents: src.dagprijs_eur * 100,
      depositCents: src.borg_eur * 100,
      seoTitle: seed.seoTitle,
      seoDescription: seed.seoDescription,
      sourceUrl: src.bron,
      sourceNote: `${src.status}. Bronnaam: “${src.naam}”.`,
    }

    const [existing] = await db.select().from(vehicles).where(eq(vehicles.slug, seed.slug))
    let vehicleId: string
    if (existing) {
      vehicleId = existing.id
      console.log(`· ${seed.name} bestaat al; inhoud niet overschreven.`)
    } else {
      const [row] = await db.insert(vehicles).values({ ...values, publishedAt: new Date() }).returning({ id: vehicles.id })
      vehicleId = row!.id
      console.log(`+ ${seed.name}`)
    }
    vehicleIds.set(seed.sourceId, vehicleId)

    // Foto’s: dezelfde pijplijn als uploads in het beheer.
    for (const [order, photo] of seed.photos.entries()) {
      const rel = `fotos/${seed.sourceId}/${photo.file}`
      const meta = photoSources.find((p) => p.bestand === rel)
      const buffer = await readFile(join(SOURCE_DIR, rel))
      const { createHash } = await import('node:crypto')
      const sha = createHash('sha256').update(buffer).digest('hex')
      const [dupe] = await db
        .select({ id: media.id })
        .from(media)
        .where(and(eq(media.vehicleId, vehicleId), eq(media.sha256, sha)))
      if (dupe) {
        mediaByFile.set(photo.file, dupe.id)
        continue
      }
      const row = await storeImage(db, {
        buffer,
        originalName: photo.file,
        vehicleId,
        actorId: null,
        alt: photo.alt,
        focalX: photo.focal[0],
        focalY: photo.focal[1],
        isPublic: !photo.hidden,
        note: photo.hidden ?? null,
        sourceUrl: meta?.url ?? null,
        sortOrder: order,
      })
      mediaByFile.set(photo.file, row.id)
      process.stdout.write('.')
    }
    process.stdout.write('\n')

    const primary = mediaByFile.get(seed.photos[0]!.file)
    if (primary) {
      await db
        .update(vehicles)
        .set({ primaryMediaId: primary })
        .where(and(eq(vehicles.id, vehicleId), sql`${vehicles.primaryMediaId} IS NULL`))
    }
  }

  // Website-inhoud met gekoppelde beelden.
  await ensureDefaultSettings(db)
  const setIfEmpty = async (key: 'hero' | 'about' | 'closing', file: string) => {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key))
    const value = (row?.value ?? DEFAULT_CONTENT[key]) as { mediaId: string | null }
    if (value.mediaId) return
    await db
      .update(siteSettings)
      .set({ value: { ...value, mediaId: mediaByFile.get(file) ?? null } })
      .where(eq(siteSettings.key, key))
  }
  await setIfEmpty('hero', 'rs3-02.jpeg')
  await setIfEmpty('about', 'rsq3-08.jpeg')
  await setIfEmpty('closing', 'rs3-05.jpeg')

  const [sig] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'signature'))
  const sigValue = (sig?.value ?? DEFAULT_CONTENT.signature) as typeof DEFAULT_CONTENT.signature
  if (sigValue.chapters.length === 0) {
    // Oplopend in vermogen: SQ5 → RS3 → RS Q3 → SQ8.
    const order = ['sq5', 'rs3', 'rsq3', 'sq8'] as const
    sigValue.chapters = order.map((id) => {
      const seed = SEED_VEHICLES.find((v) => v.sourceId === id)!
      return {
        vehicleId: vehicleIds.get(id)!,
        mediaId: mediaByFile.get(seed.signatureMedia) ?? null,
        detailMediaId: mediaByFile.get(seed.signatureDetail) ?? null,
        line: seed.signatureLine,
      }
    })
    await db.update(siteSettings).set({ value: sigValue }).where(eq(siteSettings.key, 'signature'))
  }

  // Veelgestelde vragen: alleen proces-antwoorden gepubliceerd.
  for (const [i, f] of SEED_FAQS.entries()) {
    const [exists] = await db.select({ id: faqs.id }).from(faqs).where(eq(faqs.question, f.question))
    if (exists) continue
    await db.insert(faqs).values({
      topic: f.topic,
      question: f.question,
      answer: f.answer,
      status: f.publish ? 'gepubliceerd' : 'concept',
      sortOrder: i,
    })
  }

  for (const p of SEED_PAGES) {
    const [exists] = await db.select({ slug: pages.slug }).from(pages).where(eq(pages.slug, p.slug))
    if (!exists) await db.insert(pages).values({ slug: p.slug, title: p.title, body: p.body, status: 'concept' })
  }

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
