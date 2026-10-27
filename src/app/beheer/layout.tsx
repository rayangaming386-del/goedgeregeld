import type { Metadata } from 'next'
import { isPreview } from '@/server/preview'
import '@/styles/admin.css'

export const metadata: Metadata = {
  title: { default: 'Beheer', template: '%s · Beheer · Goed Geregeld' },
  robots: { index: false, follow: false, nocache: true },
}

export default function BeheerRootLayout({ children }: { children: React.ReactNode }) {
  if (isPreview()) {
    return (
      <main className="adm-empty" style={{ margin: '4rem auto', maxWidth: '36rem', padding: '0 1rem' }}>
        <h1 className="adm-title">Beheer nog niet beschikbaar</h1>
        <p>
          Dit is een voorbeeldversie van de website zonder database. Het beheer (aanvragen, planning, wagenpark, teksten) werkt pas als er
          een database is gekoppeld; zie README → “Op Vercel zetten”.
        </p>
        <p style={{ marginTop: '1.25rem' }}>
          <a className="btn btn--secondary btn--sm" href="/">
            Naar de website
          </a>
        </p>
      </main>
    )
  }
  return children
}
