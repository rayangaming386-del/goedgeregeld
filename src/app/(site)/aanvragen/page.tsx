import type { Metadata } from 'next'
import Link from 'next/link'
import { Info, WhatsApp } from '@/components/icons'
import { RequestForm } from '@/components/request/RequestForm'
import { getRequestVehicles } from '@/components/request/request-data'
import { pageMetadata } from '@/lib/seo'
import { availabilityMessage, whatsappUrl } from '@/lib/whatsapp'
import { getPublicContext, getPublishedPageSlugs } from '@/server/public/queries'
import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getPublicContext()
  return pageMetadata({
    title: 'Beschikbaarheid aanvragen',
    description: 'Vraag de beschikbaarheid aan van een Audi uit het wagenpark van Goed Geregeld. Je hoort persoonlijk wat er mogelijk is.',
    path: '/aanvragen',
    indexable: ctx.indexable,
  })
}

export default async function RequestPage({ searchParams }: PageProps<'/aanvragen'>) {
  const params = await searchParams
  const auto = typeof params.auto === 'string' ? params.auto : null
  const [ctx, vehicles, legalPages] = await Promise.all([getPublicContext(), getRequestVehicles(), getPublishedPageSlugs()])
  const { contact, process } = ctx.content
  return (
    <div className={styles.page}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.intro}>
          <p className="t-label eyebrow">Aanvragen</p>
          <h1 className="t-h1">Beschikbaarheid aanvragen</h1>
          <p className="t-lead">Kies je auto en je gewenste periode. Je hoort persoonlijk of de auto vrij is.</p>
          <ol className={styles.steps}>
            {process.steps.map((s, i) => (
              <li key={i}>
                <span className="nums">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.title}</span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            <Info size={16} />
            <span>{process.note}</span>
          </p>
          <a
            className={`btn btn--secondary ${styles.wa}`}
            href={whatsappUrl(contact.whatsapp, availabilityMessage({}))}
            rel="noopener"
            target="_blank"
          >
            <WhatsApp size={18} />
            Liever direct via WhatsApp
          </a>
          <p className={styles.small}>
            Vragen over huren? Bekijk de <Link href="/#veelgestelde-vragen">veelgestelde vragen</Link>.
          </p>
        </div>
        <div className={styles.form}>
          <RequestForm
            vehicles={vehicles}
            defaultSlug={auto}
            whatsapp={contact.whatsapp}
            rules={ctx.rules}
            privacyPublished={legalPages.includes('privacy')}
          />
        </div>
      </div>
    </div>
  )
}
