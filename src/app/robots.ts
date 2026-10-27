import type { MetadataRoute } from 'next'
import { absoluteUrl, siteUrl } from '@/lib/site'
import { getPublicContext } from '@/server/public/queries'

// Volgt de publicatie-instelling direct, zonder te wachten op een nieuwe build.
export const dynamic = 'force-dynamic'

/**
 * Concept of zonder domein: alles uitsluiten. Live en vindbaar: alles behalve
 * het beheer, met verwijzing naar de sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const ctx = await getPublicContext()
  if (!ctx.indexable || !siteUrl()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/beheer', '/beheer/'] },
    sitemap: absoluteUrl('/sitemap.xml') ?? undefined,
  }
}
