import type { PublicDayPrice, PublicDeposit } from '@/domain/pricing'
import { formatDate } from '@/domain/time'
import { formatEuro } from '@/lib/format'
import styles from './PriceTag.module.css'

/** Dagprijs met actie en markering. Toont nooit een prijs die verborgen moet blijven. */
export function PriceTag({
  price,
  size = 'md',
  showFinalNote = true,
  showConceptMark = true,
}: {
  price: PublicDayPrice
  size?: 'md' | 'lg'
  showFinalNote?: boolean
  showConceptMark?: boolean
}) {
  if (price.kind === 'verborgen') {
    return (
      <div className={`${styles.price} ${styles[size]}`}>
        <p className={styles.onRequest}>Prijs op aanvraag</p>
      </div>
    )
  }
  const promo = price.promotion
  return (
    <div className={`${styles.price} ${styles[size]}`}>
      <p className={styles.row}>
        <span className={styles.from}>{promo ? 'Actieprijs' : price.confirmed ? 'Vanaf' : 'Richtprijs'}</span>
        <span className={`${styles.amount} nums`}>
          {promo ? (
            <>
              <span className={styles.old}>
                <span className="visually-hidden">Normaal </span>
                {formatEuro(price.dayRateCents)}
              </span>{' '}
              {formatEuro(promo.dayRateCents)}
            </>
          ) : (
            formatEuro(price.dayRateCents)
          )}
        </span>
        <span className={styles.unit}>per dag{price.vatNote ? `, ${price.vatNote}` : ''}</span>
      </p>
      {promo ? (
        <p className={styles.promo}>
          {promo.title} · t/m {formatDate(new Date(promo.endsAt.getTime() - 1))}
        </p>
      ) : null}
      {!price.confirmed && showConceptMark ? <p className="concept-mark">Indicatie, nog niet bevestigd</p> : null}
      {showFinalNote ? <p className={styles.note}>Definitieve prijs op aanvraag</p> : null}
    </div>
  )
}

export function DepositLine({ deposit }: { deposit: PublicDeposit }) {
  if (deposit.kind === 'verborgen') return null
  return (
    <p className={styles.deposit}>
      <span>Borg</span>
      <span className="nums">{formatEuro(deposit.cents)}</span>
      {!deposit.confirmed ? <span className="concept-mark">indicatie</span> : null}
    </p>
  )
}
