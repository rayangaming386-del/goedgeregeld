import { preload } from 'react-dom'
import type { PublicImage } from '@/server/public/images'
import styles from './Picture.module.css'

type Props = {
  image: PublicImage
  /** `sizes`-attribuut: hoe breed het beeld op elk schermformaat wordt getoond. */
  sizes: string
  /** Alleen voor het belangrijkste beeld boven de vouw (LCP). */
  priority?: boolean
  alt?: string
  fit?: 'cover' | 'contain'
  focal?: { x: number; y: number }
  className?: string
  imgClassName?: string
  /** Wazige voorvertoning tijdens het laden. */
  placeholder?: boolean
}

/**
 * Responsieve afbeelding met AVIF, WebP en expliciete afmetingen (geen layout shift).
 * Alleen het hero-beeld krijgt prioriteit; de rest laadt lazy.
 */
export function Picture({ image, sizes, priority = false, alt, fit = 'cover', focal, className, imgClassName, placeholder = true }: Props) {
  if (priority && image.avif) {
    preload(image.src, { as: 'image', imageSrcSet: image.avif, imageSizes: sizes, fetchPriority: 'high', type: 'image/avif' })
  }
  const fx = focal?.x ?? image.focalX
  const fy = focal?.y ?? image.focalY
  return (
    <picture className={[styles.picture, className].filter(Boolean).join(' ')}>
      {image.avif ? <source type="image/avif" srcSet={image.avif} sizes={sizes} /> : null}
      {image.webp ? <source type="image/webp" srcSet={image.webp} sizes={sizes} /> : null}
      <img
        className={[styles.img, fit === 'contain' ? styles.contain : styles.cover, imgClassName].filter(Boolean).join(' ')}
        src={image.src}
        alt={alt ?? image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding={priority ? 'sync' : 'async'}
        style={{
          objectPosition: `${fx}% ${fy}%`,
          backgroundImage: placeholder && image.placeholder ? `url("${image.placeholder}")` : undefined,
        }}
      />
    </picture>
  )
}
