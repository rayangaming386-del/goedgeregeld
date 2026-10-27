import { Info } from '@/components/icons'
import { SectionHeader } from '@/components/site/SectionHeader'
import { VehicleCard } from '@/components/vehicle/VehicleCard'
import type { SiteContent } from '@/domain/content'
import type { PublicVehicle } from '@/server/public/queries'
import styles from './FleetSection.module.css'

type Props = {
  intro: SiteContent['fleetIntro']
  vehicles: PublicVehicle[]
  showIndicationNote: boolean
  level?: 'h1' | 'h2'
  id?: string
  /** Op de wagenparkpagina staat de eerste kaart bovenaan: direct laden. */
  priorityFirst?: boolean
}

export function FleetSection({ intro, vehicles, showIndicationNote, level = 'h2', id = 'wagenpark', priorityFirst = false }: Props) {
  return (
    <section id={id} className={`section surface-ink ${styles.section}`} aria-labelledby={`${id}-titel`}>
      <div className="container">
        <SectionHeader id={`${id}-titel`} eyebrow={intro.eyebrow} title={intro.title} intro={intro.intro} level={level} />
        {vehicles.length ? (
          <ul className={styles.grid} data-reveal="stagger">
            {vehicles.map((v, i) => (
              <li key={v.id}>
                <VehicleCard vehicle={v} index={i} headingLevel={level === 'h1' ? 'h2' : 'h3'} priority={priorityFirst && i === 0} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Het wagenpark wordt bijgewerkt. Neem contact op voor de actuele auto’s.</p>
        )}
        {showIndicationNote ? (
          <p className={styles.note}>
            <Info size={18} />
            <span>
              Prijzen en specificaties zijn een indicatie op basis van een eerdere opgave. De definitieve prijs, de borg en de
              voorwaarden ontvang je bij je aanvraag.
            </span>
          </p>
        ) : null}
      </div>
    </section>
  )
}
