import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

/** Bij S3-opslag komen webvarianten van een eigen domein; dat moet in img-src. */
function mediaOrigin(): string {
  const base = process.env.MEDIA_STORAGE === 's3' ? process.env.S3_PUBLIC_BASE_URL : undefined
  if (!base) return ''
  try {
    return ` ${new URL(base).origin}`
  } catch {
    return ''
  }
}

/**
 * Content Security Policy.
 * De App Router plaatst inline scripts voor de RSC-payload; zonder nonces
 * (die elke pagina dynamisch zouden maken) is 'unsafe-inline' voor scripts nodig.
 * Alle overige bronnen zijn beperkt tot het eigen domein: geen externe fonts,
 * geen trackers, geen externe afbeeldingen.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${mediaOrigin()}`,
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  // Alleen in productie (achter HTTPS); browsers negeren de header over HTTP.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  // Native modules blijven buiten de bundel.
  serverExternalPackages: ['sharp', '@node-rs/argon2', 'pg'],
  // Voorbeeldversie zonder database: de startinhoud moet mee naar de server.
  outputFileTracingIncludes: { '/**': ['./.preview/data.json'] },
  experimental: {
    // De CSS is klein (±5 kB gzip). Inline scheelt bij het eerste bezoek een
    // render-blokkerende ronde; gemeten met DevTools-throttling: FCP ±0,6 s sneller.
    inlineCss: true,
    serverActions: {
      // Foto-uploads gaan per bestand (max. 12 MB) via een Server Action.
      bodySizeLimit: '14mb',
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/beheer/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/beheer',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

export default nextConfig
