import Link from 'next/link'
import { ArrowRight, Info } from '@/components/icons'
import type { SiteContent } from '@/domain/content'
import styles from './ProcessSection.module.css'

export function ProcessSection({ process }: { process: SiteContent['process'] }) {
  return (
    <section className={`section surface-paper ${styles.section}`} aria-labelledby="proces-titel">
      <div className={`container ${styles.grid}`}>
        <div className={styles.intro}>
          <p className="t-label eyebrow" data-reveal="up">
            {process.eyebrow}
          </p>
          <h2 id="proces-titel" className="t-h2" data-reveal="lines">
            {process.title}
          </h2>
          {process.note ? (
            <p className={styles.note} data-reveal="up">
              <Info size={20} />
              <span>{process.note}</span>
            </p>
          ) : null}
          <div data-reveal="up">
            <Link href="/aanvragen" className="btn btn--secondary">
              Vraag beschikbaarheid
              <ArrowRight className="btn__icon btn__icon--move" />
            </Link>
          </div>
        </div>
        <ol className={styles.steps} data-reveal="stagger">
          {process.steps.map((step, i) => (
            <li key={i} className={styles.step}>
              <span className={`${styles.num} nums`} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className={styles.stepBody}>
                <h3 className="t-h4">
                  <span className="visually-hidden">Stap {i + 1}: </span>
                  {step.title}
                </h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
