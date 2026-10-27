import Link from 'next/link'
import { ArrowRight } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import type { PublicVehicle } from '@/server/public/queries'
import { PriceTag } from './PriceTag'
import { SpecLine } from './SpecLine'
import styles from './VehicleCard.module.css'

type Props = {
  vehicle: PublicVehicle
  index: number
  headingLevel?: 'h2' | 'h3'
  sizes?: string
  /** Beeld direct laden (bovenaan de pagina, mogelijk het grootste element). */
  priority?: boolean
}

export function VehicleCard({ vehicle, index, headingLevel = 'h3', sizes, priority = false }: Props) {
  const Heading = headingLevel
  const href = `/wagenpark/${vehicle.slug}`
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {vehicle.image ? (
          <Picture
            image={vehicle.image}
            sizes={sizes ?? '(min-width: 1280px) 24vw, (min-width: 720px) 46vw, 100vw'}
            priority={priority}
            className={styles.picture}
            imgClassName={styles.img}
          />
        ) : (
          <div className={styles.empty} />
        )}
        <span className={styles.code} aria-hidden="true">
          {vehicle.code}
        </span>
        {vehicle.featured ? <span className={`chip chip--accent ${styles.badge}`}>Uitgelicht</span> : null}
      </div>

      <div className={styles.body}>
        <p className={`t-label ${styles.meta}`}>
          <span className="nums">{String(index + 1).padStart(2, '0')}</span>
          <span aria-hidden="true">—</span>
          <span>{vehicle.edition ?? vehicle.brand}</span>
        </p>
        <Heading className={`t-h3 ${styles.title}`}>
          <Link href={href} className={styles.link}>
            {vehicle.name}
          </Link>
        </Heading>
        {vehicle.tagline ? <p className={styles.tagline}>{vehicle.tagline}</p> : null}
        <SpecLine specs={vehicle.specs} compact />

        <div className={styles.footer}>
          <PriceTag price={vehicle.price} showFinalNote={false} showConceptMark={false} />
          <div className={styles.actions}>
            <span className={`link-arrow ${styles.more}`} aria-hidden="true">
              <span>Bekijk de auto</span>
              <ArrowRight className="btn__icon btn__icon--move" size={18} />
            </span>
            <Link href={`/aanvragen?auto=${vehicle.slug}`} className={`btn btn--secondary btn--sm ${styles.request}`}>
              Vraag beschikbaarheid
              <span className="visually-hidden"> voor de {vehicle.name}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
