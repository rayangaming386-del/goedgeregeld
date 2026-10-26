import type { Metadata, Viewport } from 'next'
import { InlineScript } from '@/components/InlineScript'
import { metadataBase, SITE_NAME } from '@/lib/site'
import '@/styles/tokens.css'
import '@/styles/base.css'
import { archivo, plexMono } from './fonts'

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Markeert dat JavaScript beschikbaar is, vóór de eerste paint.
const JS_FLAG = `document.documentElement.classList.add('js')`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${archivo.variable} ${plexMono.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <InlineScript html={JS_FLAG} />
      </head>
      <body>{children}</body>
    </html>
  )
}
