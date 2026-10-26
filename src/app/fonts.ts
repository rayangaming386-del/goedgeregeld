import localFont from 'next/font/local'

/** Archivo, variabel: gewicht 300–800 en breedte 100–125% (zelf gehost, gesubset). */
export const archivo = localFont({
  src: '../fonts/archivo-var.woff2',
  variable: '--font-archivo',
  weight: '300 800',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '100% 125%' }],
})

/** IBM Plex Mono voor technische labels en specificaties. */
export const plexMono = localFont({
  src: [
    { path: '../fonts/plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/plex-mono-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
})
