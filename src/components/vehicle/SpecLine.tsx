import { formatInt, formatTenths } from '@/lib/format'
import type { PublicVehicle } from '@/server/public/queries'
import styles from './SpecLine.module.css'

/** Compacte kerngegevens: “400 pk · 500 Nm · 3,8 s 0–100”. */
export function SpecLine({ specs, compact = false }: { specs: PublicVehicle['specs']; compact?: boolean }) {
  if (!specs) return null
  const items: Array<{ value: string; unit: string; label: string }> = []
  if (specs.powerHp) items.push({ value: formatInt(specs.powerHp), unit: 'pk', label: 'vermogen' })
  if (specs.torqueNm) items.push({ value: formatInt(specs.torqueNm), unit: 'Nm', label: 'koppel' })
  if (specs.accelTenths) items.push({ value: formatTenths(specs.accelTenths), unit: 's', label: '0–100 km/u' })
  if (!items.length) return null
  return (
    <dl className={`${styles.specs} ${compact ? styles.compact : ''}`}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt className="visually-hidden">{item.label}</dt>
          <dd>
            <span className={`${styles.value} nums`}>{item.value}</span>
            <span className={styles.unit}>{item.unit}</span>
            {item.unit === 's' ? <span className={styles.hint} aria-hidden="true">0–100</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
