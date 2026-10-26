import Link from 'next/link'
import { Instagram, MapPin, WhatsApp } from '@/components/icons'
import type { SiteContent } from '@/domain/content'
import { whatsappUrl } from '@/lib/whatsapp'
import styles from './SiteFooter.module.css'

type Props = {
  content: Pick<SiteContent, 'contact' | 'footer'>
  conceptMode: boolean
  legalPages: string[]
  vehicles: Array<{ slug: string; name: string }>
}

export function SiteFooter({ content, conceptMode, legalPages, vehicles }: Props) {
  const { contact, footer } = content
  const year = new Date().getFullYear()
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" aria-label="Goed Geregeld Autoverhuur, naar de homepage" className={styles.logoLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-520.png" width={520} height={188} alt="Goed Geregeld Autoverhuur" loading="lazy" decoding="async" className={styles.logo} />
          </Link>
          {footer.tagline ? <p className={styles.tagline}>{footer.tagline}</p> : null}
        </div>

        <nav className={styles.col} aria-label="Footer">
          <h2 className="t-label">Navigatie</h2>
          <ul>
            <li><Link href="/wagenpark">Wagenpark</Link></li>
            <li><Link href="/#over-ons">Over ons</Link></li>
            <li><Link href="/#veelgestelde-vragen">Veelgestelde vragen</Link></li>
            <li><Link href="/aanvragen">Beschikbaarheid aanvragen</Link></li>
          </ul>
        </nav>

        {vehicles.length ? (
          <div className={styles.col}>
            <h2 className="t-label">Wagenpark</h2>
            <ul>
              {vehicles.map((v) => (
                <li key={v.slug}><Link href={`/wagenpark/${v.slug}`}>{v.name}</Link></li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.col}>
          <h2 className="t-label">Contact</h2>
          <ul className={styles.contact}>
            <li>
              <a href={whatsappUrl(contact.whatsapp)} rel="noopener" target="_blank">
                <WhatsApp size={18} /> <span>WhatsApp {contact.phoneDisplay}</span>
              </a>
            </li>
            {contact.instagramUrl ? (
              <li>
                <a href={contact.instagramUrl} rel="noopener" target="_blank">
                  <Instagram size={18} /> <span>Instagram {contact.instagramHandle}</span>
                </a>
              </li>
            ) : null}
            {contact.email ? (
              <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>
            ) : null}
            <li className={styles.city}>
              <MapPin size={18} /> <span>{contact.city}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>© {year} Goed Geregeld Autoverhuur</p>
        {legalPages.length ? (
          <ul className={styles.legal}>
            {legalPages.includes('privacy') ? <li><Link href="/privacy">Privacy</Link></li> : null}
            {legalPages.includes('voorwaarden') ? <li><Link href="/voorwaarden">Huurvoorwaarden</Link></li> : null}
          </ul>
        ) : null}
        {footer.legalNote ? <p className={styles.note}>{footer.legalNote}</p> : null}
        {conceptMode ? <p className={styles.concept}>Conceptversie · prijzen en gegevens onder voorbehoud</p> : null}
      </div>
    </footer>
  )
}
