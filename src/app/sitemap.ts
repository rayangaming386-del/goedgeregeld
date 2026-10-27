import type { MetadataRoute } from 'next'
import { absoluteUrl, siteUrl } from '@/lib/site'
import { getPublicContext, getPublishedPageSlugs, getPublishedVehicles } from '@/server/public/queries'

export const dynamic = 'force-dynamic'

/** Alleen gevuld wanneer de site live en vindbaar is én het domein bekend is. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ctx = await getPublicContext()
  if (!ctx.indexable || !siteUrl()) return []
  const [vehicles, legal] = await Promise.all([getPublishedVehicles(), getPublishedPageSlugs()])
  const url = (path: string) => absoluteUrl(path)!
  const newest = vehicles.reduce<Date | undefined>((max, v) => (!max || v.updatedAt > max ? v.updatedAt : max), undefined)
  return [
    { url: url('/'), lastModified: newest, changeFrequency: 'weekly', priority: 1 },
    { url: url('/wagenpark'), lastModified: newest, changeFrequency: 'weekly', priority: 0.9 },
    ...vehicles.map((v) => ({
      url: url(`/wagenpark/${v.slug}`),
      lastModified: v.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: v.images
        .slice(0, 5)
        .map((img) => img.og?.url ?? img.large)
        .filter(Boolean)
        .map(url),
    })),
    { url: url('/aanvragen'), changeFrequency: 'monthly', priority: 0.6 },
    ...legal.map((slug) => ({ url: url(`/${slug}`), changeFrequency: 'yearly' as const, priority: 0.2 })),
  ]
}
