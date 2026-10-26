/**
 * Prijsregels.
 *
 * Tarieven worden centraal per auto beheerd. Rekenregels (hoe huurdagen
 * geteld worden, btw-vermelding, weekend- en weektarief, aanvullende kosten)
 * worden pas actief wanneer de eigenaar ze heeft ingevuld én bevestigd.
 * Zolang dat niet zo is, toont de website alleen een richtprijs per dag met
 * “Definitieve prijs op aanvraag”. De borg staat altijd los van de huurprijs.
 */
import { addDaysToDateKey, BUSINESS_TZ, localDateKey, startOfLocalDay, toLocalParts, weekdayOfDateKey } from './time'

export type VatMode = 'onbekend' | 'inclusief' | 'exclusief'
export type DayCounting = 'per_24_uur' | 'per_kalenderdag'

export type PricingRules = {
  dayCounting: DayCounting | null
  vat: VatMode
  /** De eigenaar heeft de rekenregels bevestigd. */
  confirmed: boolean
}

export type ExtraCostRule = {
  id: string
  label: string
  amountCents: number
  unit: 'per_huur' | 'per_dag'
}

export type RateCard = {
  dayRateCents: number | null
  weekendRateCents: number | null
  weekRateCents: number | null
  depositCents: number | null
  extraCosts: ExtraCostRule[]
}

export type PromotionRule = {
  id: string
  title: string
  kind: 'vaste_dagprijs' | 'percentage'
  /** Eurocenten (vaste_dagprijs) of procenten (percentage). */
  value: number
  startsAt: Date
  endsAt: Date
}

export type PublicationMode = 'concept' | 'live'

export const DEFAULT_PRICING_RULES: PricingRules = { dayCounting: null, vat: 'onbekend', confirmed: false }

const DAY_MS = 86_400_000

export function vatNote(rules: PricingRules): string | null {
  if (!rules.confirmed) return null
  if (rules.vat === 'inclusief') return 'incl. btw'
  if (rules.vat === 'exclusief') return 'excl. btw'
  return null
}

export function isPromotionActiveAt(p: PromotionRule, instant: Date): boolean {
  return p.startsAt.getTime() <= instant.getTime() && instant.getTime() < p.endsAt.getTime()
}

export function applyPromotion(baseCents: number, p: PromotionRule): number {
  if (p.kind === 'vaste_dagprijs') return Math.min(baseCents, p.value)
  const pct = Math.min(Math.max(p.value, 0), 90)
  return Math.round((baseCents * (100 - pct)) / 100)
}

/** Laagste actieprijs die op een moment geldt, of null. */
function bestPromotion(baseCents: number, promotions: PromotionRule[], instant: Date) {
  let best: { promotion: PromotionRule; cents: number } | null = null
  for (const p of promotions) {
    if (!isPromotionActiveAt(p, instant)) continue
    const cents = applyPromotion(baseCents, p)
    if (cents < baseCents && (!best || cents < best.cents)) best = { promotion: p, cents }
  }
  return best
}

/* ───────────── Publieke prijsweergave ───────────── */

export type PublicDayPrice =
  | { kind: 'verborgen' }
  | {
      kind: 'dagprijs'
      dayRateCents: number
      /** Door de eigenaar bevestigd; anders indicatie (alleen in conceptmodus zichtbaar). */
      confirmed: boolean
      promotion: { title: string; dayRateCents: number; endsAt: Date } | null
      vatNote: string | null
    }

export function publicDayPrice(input: {
  rate: Pick<RateCard, 'dayRateCents'>
  confirmed: boolean
  rules: PricingRules
  promotions: PromotionRule[]
  mode: PublicationMode
  now: Date
}): PublicDayPrice {
  const { rate, confirmed, rules, promotions, mode, now } = input
  if (rate.dayRateCents === null || rate.dayRateCents === undefined) return { kind: 'verborgen' }
  if (mode === 'live' && !confirmed) return { kind: 'verborgen' }
  const best = bestPromotion(rate.dayRateCents, promotions, now)
  return {
    kind: 'dagprijs',
    dayRateCents: rate.dayRateCents,
    confirmed,
    promotion: best ? { title: best.promotion.title, dayRateCents: best.cents, endsAt: best.promotion.endsAt } : null,
    vatNote: vatNote(rules),
  }
}

export type PublicDeposit = { kind: 'verborgen' } | { kind: 'borg'; cents: number; confirmed: boolean }

export function publicDeposit(input: {
  depositCents: number | null
  confirmed: boolean
  mode: PublicationMode
}): PublicDeposit {
  if (input.depositCents === null) return { kind: 'verborgen' }
  if (input.mode === 'live' && !input.confirmed) return { kind: 'verborgen' }
  return { kind: 'borg', cents: input.depositCents, confirmed: input.confirmed }
}

/* ───────────── Berekening voor een periode ───────────── */

export type QuoteLine = { label: string; cents: number }

export type Quote =
  | { kind: 'indicatie'; reason: 'regels_onbevestigd' | 'geen_dagprijs' | 'ongeldige_periode' }
  | {
      kind: 'berekend'
      days: number
      lines: QuoteLine[]
      rentalCents: number
      extrasCents: number
      totalCents: number
      depositCents: number | null
      vatNote: string | null
      usedWeekRate: boolean
    }

type DayUnit = { reference: Date; weekend: boolean }

/** Huurdagen volgens de ingestelde telling. */
export function rentalDayUnits(start: Date, end: Date, counting: DayCounting, tz: string = BUSINESS_TZ): DayUnit[] {
  const ms = end.getTime() - start.getTime()
  if (!(ms > 0)) return []
  if (counting === 'per_24_uur') {
    const n = Math.ceil(ms / DAY_MS)
    return Array.from({ length: n }, (_, i) => {
      const reference = new Date(start.getTime() + i * DAY_MS)
      const wd = toLocalParts(reference, tz).weekday
      return { reference, weekend: wd === 0 || wd === 6 }
    })
  }
  // Per kalenderdag: elke (deels) gebruikte lokale kalenderdatum telt.
  const first = localDateKey(start, tz)
  const last = localDateKey(new Date(end.getTime() - 1), tz)
  const units: DayUnit[] = []
  for (let key = first, guard = 0; key <= last && guard < 800; key = addDaysToDateKey(key, 1), guard++) {
    const dayStart = startOfLocalDay(key, tz)
    const reference = dayStart.getTime() < start.getTime() ? start : dayStart
    const wd = weekdayOfDateKey(key)
    units.push({ reference, weekend: wd === 0 || wd === 6 })
  }
  return units
}

export function calculateQuote(input: {
  start: Date
  end: Date
  rate: RateCard
  rules: PricingRules
  promotions: PromotionRule[]
  tz?: string
}): Quote {
  const { start, end, rate, rules, promotions } = input
  if (!(end.getTime() > start.getTime())) return { kind: 'indicatie', reason: 'ongeldige_periode' }
  if (!rules.confirmed || !rules.dayCounting) return { kind: 'indicatie', reason: 'regels_onbevestigd' }
  if (rate.dayRateCents === null) return { kind: 'indicatie', reason: 'geen_dagprijs' }

  const units = rentalDayUnits(start, end, rules.dayCounting, input.tz)
  const dayRate = rate.dayRateCents
  const priced = units.map((u) => {
    const base = u.weekend && rate.weekendRateCents !== null ? rate.weekendRateCents : dayRate
    const promo = bestPromotion(base, promotions, u.reference)
    return { ...u, base, cents: promo ? promo.cents : base, promotion: promo?.promotion ?? null }
  })

  const dayBased = priced.reduce((sum, u) => sum + u.cents, 0)
  let rentalCents = dayBased
  let usedWeekRate = false
  const lines: QuoteLine[] = []

  if (rate.weekRateCents !== null && priced.length >= 7) {
    const weeks = Math.floor(priced.length / 7)
    const rest = priced.slice(weeks * 7)
    const weekBased = weeks * rate.weekRateCents + rest.reduce((s, u) => s + u.cents, 0)
    if (weekBased < dayBased) {
      rentalCents = weekBased
      usedWeekRate = true
      lines.push({ label: `${weeks} ${weeks === 1 ? 'week' : 'weken'} weektarief`, cents: weeks * rate.weekRateCents })
      pushDayLines(lines, rest)
    }
  }
  if (!usedWeekRate) pushDayLines(lines, priced)

  let extrasCents = 0
  for (const extra of rate.extraCosts) {
    const cents = extra.unit === 'per_dag' ? extra.amountCents * units.length : extra.amountCents
    extrasCents += cents
    lines.push({ label: extra.unit === 'per_dag' ? `${extra.label} (${units.length} × dag)` : extra.label, cents })
  }

  return {
    kind: 'berekend',
    days: units.length,
    lines,
    rentalCents,
    extrasCents,
    totalCents: rentalCents + extrasCents,
    depositCents: rate.depositCents,
    vatNote: vatNote(rules),
    usedWeekRate,
  }
}

function pushDayLines(
  lines: QuoteLine[],
  units: Array<{ weekend: boolean; cents: number; promotion: PromotionRule | null }>,
) {
  const groups = new Map<string, { count: number; unitCents: number; label: string }>()
  for (const u of units) {
    const kind = u.promotion ? `actie: ${u.promotion.title}` : u.weekend ? 'weekenddag' : 'dag'
    const key = `${kind}|${u.cents}`
    const g = groups.get(key)
    if (g) g.count++
    else groups.set(key, { count: 1, unitCents: u.cents, label: kind })
  }
  for (const g of groups.values()) {
    const noun =
      g.label === 'dag'
        ? g.count === 1
          ? 'dag'
          : 'dagen'
        : g.label === 'weekenddag'
          ? g.count === 1
            ? 'weekenddag'
            : 'weekenddagen'
          : `${g.count === 1 ? 'dag' : 'dagen'} (${g.label})`
    lines.push({ label: `${g.count} ${noun} × ${formatEuroPlain(g.unitCents)}`, cents: g.count * g.unitCents })
  }
}

function formatEuroPlain(cents: number): string {
  const euros = cents / 100
  return `€ ${Number.isInteger(euros) ? euros.toLocaleString('nl-NL') : euros.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ───────────── Validatie van acties ───────────── */

export type PromotionCheckInput = {
  id?: string
  kind: 'vaste_dagprijs' | 'percentage'
  value: number
  startsAt: Date
  endsAt: Date
  vehicleIds: string[]
}

export type PromotionIssue = { field: 'value' | 'period' | 'vehicles'; message: string }

/**
 * Controle op onlogische acties: periode, waarde, lege selectie, een actieprijs
 * die niet onder de dagprijs ligt en overlap met andere live acties voor dezelfde auto.
 */
export function checkPromotion(
  input: PromotionCheckInput,
  context: {
    dayRates: Map<string, number | null>
    otherLivePromotions: Array<{ id: string; title: string; startsAt: Date; endsAt: Date; vehicleIds: string[] }>
  },
): PromotionIssue[] {
  const issues: PromotionIssue[] = []
  if (!(input.endsAt.getTime() > input.startsAt.getTime())) {
    issues.push({ field: 'period', message: 'De einddatum moet na de begindatum liggen.' })
  }
  if (input.vehicleIds.length === 0) {
    issues.push({ field: 'vehicles', message: 'Kies minstens één auto.' })
  }
  if (input.kind === 'percentage') {
    if (!Number.isInteger(input.value) || input.value < 1 || input.value > 90) {
      issues.push({ field: 'value', message: 'Een kortingspercentage ligt tussen 1 en 90.' })
    }
  } else {
    if (!Number.isInteger(input.value) || input.value <= 0) {
      issues.push({ field: 'value', message: 'Vul een actieprijs per dag in.' })
    } else {
      for (const id of input.vehicleIds) {
        const day = context.dayRates.get(id)
        if (day !== null && day !== undefined && input.value >= day) {
          issues.push({
            field: 'value',
            message: 'De actieprijs moet lager zijn dan de gewone dagprijs van elke gekozen auto.',
          })
          break
        }
      }
    }
  }
  for (const other of context.otherLivePromotions) {
    if (other.id === input.id) continue
    const sharesVehicle = other.vehicleIds.some((v) => input.vehicleIds.includes(v))
    const overlapsPeriod =
      input.startsAt.getTime() < other.endsAt.getTime() && other.startsAt.getTime() < input.endsAt.getTime()
    if (sharesVehicle && overlapsPeriod) {
      issues.push({
        field: 'period',
        message: `Overlapt met de live actie “${other.title}” voor dezelfde auto.`,
      })
    }
  }
  return issues
}
