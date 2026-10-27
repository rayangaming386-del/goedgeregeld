/**
 * Beeldverwerking: inhoudelijke validatie (niet op extensie vertrouwen),
 * EXIF-oriëntatie, metadata strippen en webvarianten in AVIF, WebP en JPEG.
 * Het origineel blijft ongewijzigd bewaard.
 */
import { createHash } from 'node:crypto'
import sharp, { type Metadata } from 'sharp'
import type { MediaVariant } from '../db/schema'

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

/**
 * Grootste bestand dat in één verzoek past. Vercel weigert verzoeken boven
 * 4,5 MB; grotere foto’s verkleint het beheer dan eerst in de browser.
 */
export function uploadLimitBytes(): number {
  return process.env.VERCEL ? 4 * 1024 * 1024 : MAX_UPLOAD_BYTES
}
export const MIN_SHORT_SIDE = 400
export const MAX_PIXELS = 60_000_000
export const VARIANT_WIDTHS = [480, 768, 1080, 1440, 1920] as const
const OG_WIDTH = 1200

export class ImageValidationError extends Error {}

export type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'avif'

const MIME: Record<DetectedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

export const EXTENSION: Record<DetectedFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' }

/** Leest het formaat uit de bestandsinhoud via libvips. */
export async function inspectImage(buffer: Buffer): Promise<{ format: DetectedFormat; width: number; height: number }> {
  if (buffer.byteLength === 0) throw new ImageValidationError('Het bestand is leeg.')
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError('Het bestand is groter dan 12 MB.')
  }
  let meta: Metadata
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata()
  } catch {
    throw new ImageValidationError('Dit bestand is geen leesbare afbeelding.')
  }
  let format: DetectedFormat | null = null
  if (meta.format === 'jpeg' || meta.format === 'png' || meta.format === 'webp') format = meta.format
  else if (meta.format === 'heif' && meta.compression === 'av1') format = 'avif'
  if (!format) {
    const hint = meta.format === 'heif' ? ' HEIC-foto’s van een iPhone eerst als JPEG exporteren.' : ''
    throw new ImageValidationError(`Dit bestandstype wordt niet ondersteund. Gebruik JPEG, PNG, WebP of AVIF.${hint}`)
  }
  if ((meta.pages ?? 1) > 1) throw new ImageValidationError('Geanimeerde of meerbladige afbeeldingen worden niet ondersteund.')
  // Rekening houden met EXIF-rotatie (oriëntatie 5–8 wisselt breedte en hoogte).
  const rotated = (meta.orientation ?? 1) >= 5
  const width = (rotated ? meta.height : meta.width) ?? 0
  const height = (rotated ? meta.width : meta.height) ?? 0
  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    throw new ImageValidationError(`De afbeelding is te klein (${width} × ${height}). Minimaal ${MIN_SHORT_SIDE} pixels aan de korte kant.`)
  }
  return { format, width, height }
}

export type ProcessedImage = {
  format: DetectedFormat
  mime: string
  width: number
  height: number
  bytes: number
  sha256: string
  placeholder: string
  variants: Array<MediaVariant & { buffer: Buffer }>
}

export function variantWidthsFor(originalWidth: number): number[] {
  const widths: number[] = VARIANT_WIDTHS.filter((w) => w < originalWidth)
  if (originalWidth <= VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!) widths.push(originalWidth)
  else widths.push(VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!)
  return [...new Set(widths)].sort((a, b) => a - b)
}

/**
 * Maakt webvarianten. `keyPrefix` is bijvoorbeeld `variants/<mediaId>/<hash>`.
 */
export async function processImage(buffer: Buffer, keyPrefix: string): Promise<ProcessedImage> {
  const info = await inspectImage(buffer)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const base = () => sharp(buffer, { limitInputPixels: MAX_PIXELS }).rotate()

  // Alle varianten parallel (libuv-threadpool); AVIF met effort 2: ±7× sneller
  // dan de standaard bij vrijwel gelijke bestandsgrootte.
  const ogWidth = Math.min(OG_WIDTH, info.width)
  const heightFor = (w: number) => Math.round((info.height / info.width) * w)
  const jobs: Array<Promise<ProcessedImage['variants'][number]>> = []
  for (const width of variantWidthsFor(info.width)) {
    const resized = () => base().resize({ width, withoutEnlargement: true })
    jobs.push(
      resized()
        .avif({ quality: 52, effort: 2, chromaSubsampling: '4:2:0' })
        .toBuffer()
        .then((buf) => ({ format: 'avif' as const, width, height: heightFor(width), key: `${keyPrefix}/${width}.avif`, bytes: buf.byteLength, buffer: buf })),
      resized()
        .webp({ quality: 76, effort: 4 })
        .toBuffer()
        .then((buf) => ({ format: 'webp' as const, width, height: heightFor(width), key: `${keyPrefix}/${width}.webp`, bytes: buf.byteLength, buffer: buf })),
    )
  }
  jobs.push(
    base()
      .resize({ width: ogWidth })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toBuffer()
      .then((buf) => ({ format: 'jpeg' as const, width: ogWidth, height: heightFor(ogWidth), key: `${keyPrefix}/${ogWidth}.jpg`, bytes: buf.byteLength, buffer: buf })),
  )
  const [variants, tiny] = await Promise.all([
    Promise.all(jobs),
    base().resize({ width: 24 }).blur(0.6).webp({ quality: 40 }).toBuffer(),
  ])
  const placeholder = `data:image/webp;base64,${tiny.toString('base64')}`

  return {
    format: info.format,
    mime: MIME[info.format],
    width: info.width,
    height: info.height,
    bytes: buffer.byteLength,
    sha256,
    placeholder,
    variants,
  }
}

// Elke versie heeft een eigen URL. s-maxage laat ook een CDN (bijv. Vercel)
// de foto bewaren, zodat de database of bucket er zelden voor wordt gevraagd;
// korter dan in de browser, zodat een verwijderde foto daar binnen een dag weg is.
export const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=86400, immutable'

export function contentTypeForVariant(format: MediaVariant['format']): string {
  return format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg'
}
