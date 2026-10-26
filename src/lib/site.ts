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

/** Basis voor metadata; valt terug op localhost wanneer er nog geen domein is. */
export function metadataBase(): URL {
  return new URL(siteUrl() ?? `http://localhost:${process.env.PORT ?? 3000}`)
}

export function absoluteUrl(path: string): string | null {
  const base = siteUrl()
  return base ? new URL(path, base).toString() : null
}

export const SITE_NAME = 'Goed Geregeld Autoverhuur'
