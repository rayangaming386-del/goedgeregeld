import { contentTypeForVariant, VARIANT_CACHE_CONTROL } from '@/server/media/pipeline'
import { isPreview } from '@/server/preview'
import { getStorage, PUBLIC_PREFIX } from '@/server/storage'

/**
 * Serveert webvarianten uit lokale opslag of de database. Originelen
 * (originals/) zijn hier bewust niet bereikbaar. Bij S3-opslag verwijzen de
 * URL’s rechtstreeks naar de bucket en wordt deze route niet gebruikt.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  // In de voorbeeldversie staan de foto’s als vaste bestanden in public/media/; wat daar niet is, bestaat niet.
  if (isPreview()) return new Response('Niet gevonden', { status: 404 })
  const rel = path.join('/')
  if (!/^[0-9a-f-]{36}\/[0-9a-f]{8}\/\d{2,5}\.(avif|webp|jpg)$/.test(rel)) {
    return new Response('Niet gevonden', { status: 404 })
  }
  const key = `${PUBLIC_PREFIX}${rel}`
  const body = await getStorage().get(key)
  if (!body) return new Response('Niet gevonden', { status: 404 })
  const ext = rel.split('.').pop() as 'avif' | 'webp' | 'jpg'
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': contentTypeForVariant(ext === 'jpg' ? 'jpeg' : ext),
      'Cache-Control': VARIANT_CACHE_CONTROL,
      'Content-Length': String(body.byteLength),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
