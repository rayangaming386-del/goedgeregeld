'use client'

import Link from 'next/link'
import { StatusPage } from '@/components/site/StatusPage'

/** Onverwachte fout op de website: geen technische details tonen. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage code="Storing" title="Er ging iets mis bij het laden." text="Probeer het opnieuw. Lukt het niet, kijk dan later nog eens of neem contact op via WhatsApp of Instagram.">
      <button type="button" className="btn btn--primary" onClick={() => reset()}>
        Opnieuw proberen
      </button>
      <Link href="/" className="btn btn--secondary">
        Naar de homepage
      </Link>
    </StatusPage>
  )
}
