import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusPage } from '@/components/site/StatusPage'

export const metadata: Metadata = { title: 'Pagina niet gevonden', robots: { index: false, follow: true } }

export default function NotFound() {
  return (
    <StatusPage code="404 · niet gevonden" title="Deze pagina bestaat niet (meer)." text="Misschien is de auto niet meer beschikbaar of is het adres veranderd. Bekijk het wagenpark of ga terug naar de homepage.">
      <Link href="/wagenpark" className="btn btn--primary">
        Bekijk het wagenpark
      </Link>
      <Link href="/" className="btn btn--secondary">
        Naar de homepage
      </Link>
    </StatusPage>
  )
}
