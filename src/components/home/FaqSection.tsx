import { Plus, WhatsApp } from '@/components/icons'
import type { SiteContent } from '@/domain/content'
import { whatsappUrl } from '@/lib/whatsapp'
import type { PublicFaq } from '@/server/public/queries'
import styles from './FaqSection.module.css'

type Props = {
  intro: SiteContent['faqIntro']
  faqs: PublicFaq[]
  whatsapp: string
}

/** Veelgestelde vragen met native details/summary: toegankelijk en werkt zonder JavaScript. */
export function FaqSection({ intro, faqs, whatsapp }: Props) {
  return (
    <section id="veelgestelde-vragen" className={`section surface-ink ${styles.section}`} aria-labelledby="faq-titel">
      <div className={`container ${styles.grid}`}>
        <div className={styles.head}>
          <p className="t-label eyebrow" data-reveal="up">
            {intro.eyebrow}
          </p>
          <h2 id="faq-titel" className="t-h2" data-reveal="lines">
            {intro.title}
          </h2>
          {intro.outro ? (
            <div className={styles.outro} data-reveal="up">
              <p>{intro.outro}</p>
              <a href={whatsappUrl(whatsapp, 'Hallo Goed Geregeld, ik heb een vraag:')} className="btn btn--secondary btn--sm" rel="noopener" target="_blank">
                <WhatsApp size={18} />
                Stel je vraag via WhatsApp
              </a>
            </div>
          ) : null}
        </div>
        <div className={styles.list} data-reveal="stagger">
          {faqs.map((faq) => (
            <details key={faq.id} className={styles.item}>
              <summary className={styles.question}>
                <span>{faq.question}</span>
                <span className={styles.icon} aria-hidden="true">
                  <Plus size={20} />
                </span>
              </summary>
              <div className={styles.answer}>
                {faq.answer.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
