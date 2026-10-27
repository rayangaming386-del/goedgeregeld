import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusPage } from '@/components/site/StatusPage'

export const metadata: Metadata = { title: 'Pagina niet gevonden', robots: { index: false, follow: true } }

/** Voor adressen buiten de websitelay-out. */
export default function RootNotFound() {
  return (
    <main id="inhoud">
      <StatusPage standalone code="404 · niet gevonden" title="Deze pagina bestaat niet (meer)." text="Het adres klopt niet of de pagina is verplaatst.">
        <Link href="/" className="btn btn--primary">
          Naar de homepage
        </Link>
        <Link href="/wagenpark" className="btn btn--secondary">
          Bekijk het wagenpark
        </Link>
      </StatusPage>
    </main>
  )
}
