/**
 * Maakt de voorbeeldversie zonder database (zie src/server/preview):
 * `.preview/data.json` met de vier auto’s, foto’s en teksten uit de
 * startinhoud, en de webversies van de foto’s in `public/media/`.
 * Dezelfde inhoud en dezelfde beeldverwerking als `pnpm db:seed`.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_CONTENT } from '../src/domain/content'
import { processImage } from '../src/server/media/pipeline'
import { PREVIEW_DATA_FILE, type PreviewData, type PreviewPhoto, type PreviewVehicle } from '../src/server/preview'
import { SEED_FAQS, SEED_VEHICLES } from './seed-data'

const SOURCE_DIR = join(process.cwd(), 'bronmateriaal')
const PUBLIC_MEDIA = join(process.cwd(), 'public', 'media')

type SourceVehicle = {
  id: string
  minimumleeftijd: number
  kilometers: string
  kentekenland: string
  transmissie: string
  vermogen_pk: number
  koppel_nm: number
  nul_tot_honderd_seconden: number
  dagprijs_eur: number
  borg_eur: number
}

/** Vaste id per naam, zodat opnieuw bouwen dezelfde adressen geeft. */
function stableId(name: string): string {
  const h = createHash('sha256').update(`goedgeregeld:voorbeeld:${name}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export async function buildPreview(): Promise<{ vehicles: number; photos: number }> {
  const source: SourceVehicle[] = JSON.parse(await readFile(join(SOURCE_DIR, 'wagenpark.json'), 'utf8'))
  await rm(PUBLIC_MEDIA, { recursive: true, force: true })

  const now = new Date().toISOString()
  const vehicles: PreviewVehicle[] = []
  const photos: PreviewPhoto[] = []
  const byFile = new Map<string, string>()

  for (const [index, seed] of SEED_VEHICLES.entries()) {
    const src = source.find((s) => s.id === seed.sourceId)
    if (!src) throw new Error(`Geen brondata voor ${seed.sourceId}`)
    const vehicleId = stableId(seed.slug)

    // Promotiebeelden met tekst (hidden) zijn ook in de echte installatie niet publiek.
    for (const [order, photo] of seed.photos.entries()) {
      if (photo.hidden) continue
      const buffer = await readFile(join(SOURCE_DIR, 'fotos', seed.sourceId, photo.file))
      const id = stableId(photo.file)
      const version = createHash('sha256').update(buffer).digest('hex').slice(0, 8)
      const processed = await processImage(buffer, `variants/${id}/${version}`)
      for (const v of processed.variants) {
        const file = join(PUBLIC_MEDIA, v.key.replace(/^variants\//, ''))
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, v.buffer)
      }
      photos.push({
        id,
        vehicleId,
        alt: photo.alt,
        width: processed.width,
        height: processed.height,
        focalX: photo.focal[0],
        focalY: photo.focal[1],
        placeholder: processed.placeholder,
        variants: processed.variants.map(({ buffer: _b, ...rest }) => rest),
        sortOrder: order,
      })
      byFile.set(photo.file, id)
      process.stdout.write('.')
    }

    const firstPublic = seed.photos.find((p) => !p.hidden)
    vehicles.push({
      id: vehicleId,
      slug: seed.slug,
      name: seed.name,
      brand: 'Audi',
      model: seed.model,
      edition: seed.edition,
      tagline: seed.tagline,
      description: seed.description,
      highlights: seed.highlights,
      featured: seed.sourceId === 'sq8',
      powerHp: src.vermogen_pk,
      torqueNm: src.koppel_nm,
      accelTenths: Math.round(src.nul_tot_honderd_seconden * 10),
      transmission: src.transmissie,
      modelYear: seed.modelYear,
      minAge: src.minimumleeftijd,
      mileagePolicy: src.kilometers,
      plateCountry: src.kentekenland,
      dayRateCents: src.dagprijs_eur * 100,
      depositCents: src.borg_eur * 100,
      primaryMediaId: firstPublic ? (byFile.get(firstPublic.file) ?? null) : null,
      seoTitle: seed.seoTitle,
      seoDescription: seed.seoDescription,
      sortOrder: index,
      updatedAt: now,
    })
  }
  process.stdout.write('\n')

  // Zelfde koppeling van beelden aan de homepage-secties als de seed.
  const withImage = <K extends 'hero' | 'about' | 'closing'>(key: K, file: string) => ({ ...DEFAULT_CONTENT[key], mediaId: byFile.get(file) ?? null })
  const order = ['sq5', 'rs3', 'rsq3', 'sq8'] as const
  const settings: PreviewData['settings'] = {
    hero: withImage('hero', 'rs3-02.jpeg'),
    about: withImage('about', 'rsq3-08.jpeg'),
    closing: withImage('closing', 'rs3-05.jpeg'),
    signature: {
      ...DEFAULT_CONTENT.signature,
      chapters: order.map((id) => {
        const seed = SEED_VEHICLES.find((v) => v.sourceId === id)!
        return {
          vehicleId: stableId(seed.slug),
          mediaId: byFile.get(seed.signatureMedia) ?? null,
          detailMediaId: byFile.get(seed.signatureDetail) ?? null,
          line: seed.signatureLine,
        }
      }),
    },
  }

  const data: PreviewData = {
    vehicles,
    photos,
    // Alleen de gepubliceerde vragen (over het proces), zoals in de echte installatie.
    faqs: SEED_FAQS.filter((f) => f.publish).map((f) => ({ id: stableId(f.question), question: f.question, answer: f.answer })),
    settings,
  }
  const file = join(process.cwd(), PREVIEW_DATA_FILE)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
  return { vehicles: vehicles.length, photos: photos.length }
}
