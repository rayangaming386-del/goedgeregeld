import type { Metadata } from 'next'
import type { PublicImage } from '@/server/public/images'
import { absoluteUrl, SITE_NAME, siteUrl } from './site'

type Options = {
  title: string
  description: string
  path: string
  image?: PublicImage | null
  indexable: boolean
  absoluteTitle?: boolean
}

/** Metadata per pagina: canonical alleen met een bekend domein, noindex in conceptmodus. */
export function pageMetadata({ title, description, path, image, indexable, absoluteTitle }: Options): Metadata {
  const hasDomain = Boolean(siteUrl())
  const og = image?.og
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: hasDomain ? { canonical: path } : undefined,
    robots: indexable && hasDomain ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      locale: 'nl_NL',
      siteName: SITE_NAME,
      title,
      description,
      url: hasDomain ? path : undefined,
      images: og ? [{ url: og.url, width: og.width, height: og.height, alt: image?.alt ?? '' }] : undefined,
    },
    twitter: { card: og ? 'summary_large_image' : 'summary', title, description },
  }
}

/** JSON-LD veilig als scripttekst. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function abs(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return absoluteUrl(path) ?? undefined
}
