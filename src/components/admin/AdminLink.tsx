import Link from 'next/link'
import type { ComponentProps } from 'react'

/**
 * Link in het beheer zonder prefetch. Beheerpagina’s zijn dynamisch; vooraf
 * laden zou voor elke zichtbare link een volledige server-render met
 * databasequery’s kosten (gemeten: ±60 verzoeken per pagina).
 */
export function AdminLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />
}
