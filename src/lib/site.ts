/** De uiteindelijke domeinnaam (SITE_URL). Leeg in een concept zonder domein. */
export function siteUrl(): string | null {
  const raw = process.env.SITE_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.origin
  } catch {
    return null
  }
}

/**
 * Basis voor metadata (o.a. deelafbeeldingen). Zonder domein: het Vercel-adres
 * van deze deployment, zodat een gedeelde link een voorbeeld toont; anders localhost.
 */
export function metadataBase(): URL {
  const vercel =
    process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
  return new URL(siteUrl() ?? (vercel ? `https://${vercel}` : `http://localhost:${process.env.PORT ?? 3000}`))
}

export function absoluteUrl(path: string): string | null {
  const base = siteUrl()
  return base ? new URL(path, base).toString() : null
}

export const SITE_NAME = 'Goed Geregeld Autoverhuur'
