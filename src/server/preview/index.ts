/**
 * Voorbeeldversie zonder database (bijv. een eerste Vercel-deployment).
 *
 * Zonder DATABASE_URL toont de website de startinhoud uit `bronmateriaal/`:
 * de vier auto’s, foto’s, teksten en veelgestelde vragen. `pnpm deploy:prepare`
 * maakt die vóór de build aan (`.preview/data.json` en de foto’s in
 * `public/media/`). Het beheer en het versturen van aanvragen werken dan niet;
 * dat staat ook zo op de website.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MediaVariant } from '../db/schema'

export const PREVIEW_DATA_FILE = join('.preview', 'data.json')

export function isPreview(): boolean {
  return !process.env.DATABASE_URL
}

export type PreviewVehicle = {
  id: string
  slug: string
  name: string
  brand: string
  model: string
  edition: string | null
  tagline: string
  description: string
  highlights: string[] | null
  featured: boolean
  powerHp: number | null
  torqueNm: number | null
  accelTenths: number | null
  transmission: string | null
  modelYear: number | null
  minAge: number | null
  mileagePolicy: string | null
  plateCountry: string | null
  dayRateCents: number | null
  depositCents: number | null
  primaryMediaId: string | null
  seoTitle: string | null
  seoDescription: string | null
  sortOrder: number
  updatedAt: string
}

export type PreviewPhoto = {
  id: string
  vehicleId: string | null
  alt: string
  width: number
  height: number
  focalX: number
  focalY: number
  placeholder: string | null
  variants: MediaVariant[]
  sortOrder: number
}

export type PreviewData = {
  vehicles: PreviewVehicle[]
  photos: PreviewPhoto[]
  faqs: Array<{ id: string; question: string; answer: string }>
  /** Instellingen die afwijken van de standaardinhoud (beelden bij de secties). */
  settings: Record<string, unknown>
}

let cached: PreviewData | null = null

export function previewData(): PreviewData {
  if (cached) return cached
  try {
    cached = JSON.parse(readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), PREVIEW_DATA_FILE), 'utf8')) as PreviewData
  } catch {
    // Nog niet aangemaakt (bijv. `next dev` zonder database): een lege website.
    cached = { vehicles: [], photos: [], faqs: [], settings: {} }
  }
  return cached
}

export const PREVIEW_REQUEST_MESSAGE =
  'Dit is een voorbeeldversie van de website zonder database: je aanvraag is niet verstuurd en niet opgeslagen. Stuur je aanvraag via WhatsApp.'
