'use client'

/**
 * Inline script dat vóór de eerste paint draait. Op de server ‘text/javascript’,
 * in de browser ‘text/plain’ zodat React het bij client-rendering niet opnieuw
 * als uitvoerbaar script aanmaakt (zie Next-gids “preventing flash”).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
