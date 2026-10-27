/**
 * Startinhoud: vier auto’s met foto’s (via dezelfde pijplijn als uploads),
 * website-inhoud, veelgestelde vragen en pagina’s. Idempotent: bestaande
 * gegevens worden niet overschreven of dubbel aangemaakt.
 *
 * Gebruikt door `pnpm db:seed` en door de deploy-voorbereiding (alleen bij een
 * lege database).
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { DEFAULT_CONTENT } from '../src/domain/content'
import type { Database } from '../src/server/db/client'
import { faqs, media, pages, siteSettings, vehicles } from '../src/server/db/schema'
import { storeImage } from '../src/server/media/service'
import { ensureDefaultSettings } from '../src/server/content/settings'
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

/** Geeft per bron-id (rs3, rsq3, sq5, sq8) het id van de auto terug. */
export async function seedContent(db: Database): Promise<Map<string, string>> {
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

  return vehicleIds
}
