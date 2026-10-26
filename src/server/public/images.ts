import type { Media } from '../db/schema'
import { getStorage } from '../storage'

/** Publieke weergave van een afbeelding: alleen wat de browser nodig heeft. */
export type PublicImage = {
  id: string
  alt: string
  width: number
  height: number
  focalX: number
  focalY: number
  placeholder: string | null
  avif: string
  webp: string
  /** Middelgrote WebP voor <img src> */
  src: string
  /** Grootste WebP, voor de lightbox */
  large: string
  /** JPEG voor Open Graph */
  og: { url: string; width: number; height: number } | null
}

export function toPublicImage(m: Pick<Media, 'id' | 'alt' | 'width' | 'height' | 'focalX' | 'focalY' | 'placeholder' | 'variants'>): PublicImage {
  const storage = getStorage()
  const byFormat = (f: 'avif' | 'webp') => m.variants.filter((v) => v.format === f).sort((a, b) => a.width - b.width)
  const avif = byFormat('avif')
  const webp = byFormat('webp')
  const srcset = (list: typeof webp) => list.map((v) => `${storage.publicUrl(v.key)} ${v.width}w`).join(', ')
  const mid = webp.filter((v) => v.width <= 1080).at(-1) ?? webp[0]
  const largest = webp.at(-1)
  const jpeg = m.variants.find((v) => v.format === 'jpeg')
  return {
    id: m.id,
    alt: m.alt,
    width: m.width,
    height: m.height,
    focalX: m.focalX,
    focalY: m.focalY,
    placeholder: m.placeholder,
    avif: srcset(avif),
    webp: srcset(webp),
    src: mid ? storage.publicUrl(mid.key) : '',
    large: largest ? storage.publicUrl(largest.key) : '',
    og: jpeg ? { url: storage.publicUrl(jpeg.key), width: jpeg.width, height: jpeg.height } : null,
  }
}
