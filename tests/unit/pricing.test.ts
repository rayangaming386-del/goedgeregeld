import { describe, expect, it } from 'vitest'
import {
  calculateQuote,
  checkPromotion,
  DEFAULT_PRICING_RULES,
  publicDayPrice,
  publicDeposit,
  rentalDayUnits,
  type PricingRules,
  type PromotionRule,
  type RateCard,
} from '@/domain/pricing'

const d = (iso: string) => new Date(iso)
const now = d('2026-11-01T12:00:00Z')

const rate: RateCard = {
  dayRateCents: 40_000,
  weekendRateCents: null,
  weekRateCents: null,
  depositCents: 200_000,
  extraCosts: [],
}

const confirmedRules: PricingRules = { dayCounting: 'per_24_uur', vat: 'inclusief', confirmed: true }

const promo = (p: Partial<PromotionRule>): PromotionRule => ({
  id: 'p1',
  title: 'Najaarsactie',
  kind: 'vaste_dagprijs',
  value: 35_000,
  startsAt: d('2026-11-01T00:00:00Z'),
  endsAt: d('2026-12-01T00:00:00Z'),
  ...p,
})

describe('publieke dagprijs', () => {
  it('toont een richtprijs in conceptmodus zolang niets bevestigd is', () => {
    const p = publicDayPrice({ rate, confirmed: false, rules: DEFAULT_PRICING_RULES, promotions: [], mode: 'concept', now })
    expect(p).toEqual({ kind: 'dagprijs', dayRateCents: 40_000, confirmed: false, promotion: null, vatNote: null })
  })

  it('verbergt onbevestigde prijzen zodra de site live staat', () => {
    expect(publicDayPrice({ rate, confirmed: false, rules: DEFAULT_PRICING_RULES, promotions: [], mode: 'live', now })).toEqual({
      kind: 'verborgen',
    })
  })

  it('verbergt de prijs als er geen dagprijs is', () => {
    expect(
      publicDayPrice({ rate: { dayRateCents: null }, confirmed: true, rules: confirmedRules, promotions: [], mode: 'live', now }),
    ).toEqual({ kind: 'verborgen' })
  })

  it('noemt btw alleen bij bevestigde regels', () => {
    const p = publicDayPrice({ rate, confirmed: true, rules: confirmedRules, promotions: [], mode: 'live', now })
    expect(p.kind === 'dagprijs' && p.vatNote).toBe('incl. btw')
  })

  it('past een lopende actie toe en negeert verlopen acties', () => {
    const active = publicDayPrice({ rate, confirmed: true, rules: confirmedRules, promotions: [promo({})], mode: 'live', now })
    expect(active.kind === 'dagprijs' && active.promotion?.dayRateCents).toBe(35_000)
    const expired = publicDayPrice({
      rate,
      confirmed: true,
      rules: confirmedRules,
      promotions: [promo({ startsAt: d('2026-10-01T00:00:00Z'), endsAt: d('2026-11-01T00:00:00Z') })],
      mode: 'live',
      now,
    })
    expect(expired.kind === 'dagprijs' && expired.promotion).toBeNull()
  })

  it('toont de borg los en alleen wanneer toegestaan', () => {
    expect(publicDeposit({ depositCents: 200_000, confirmed: false, mode: 'concept' })).toEqual({
      kind: 'borg',
      cents: 200_000,
      confirmed: false,
    })
    expect(publicDeposit({ depositCents: 200_000, confirmed: false, mode: 'live' })).toEqual({ kind: 'verborgen' })
  })
})

describe('huurdagen tellen', () => {
  it('per 24 uur: elk begonnen etmaal telt', () => {
    expect(rentalDayUnits(d('2026-11-07T09:00:00Z'), d('2026-11-08T09:00:00Z'), 'per_24_uur')).toHaveLength(1)
    expect(rentalDayUnits(d('2026-11-07T09:00:00Z'), d('2026-11-08T09:01:00Z'), 'per_24_uur')).toHaveLength(2)
  })

  it('per kalenderdag: elke gebruikte lokale datum telt', () => {
    // za 10:00 – zo 18:00 lokaal = 2 kalenderdagen
    expect(rentalDayUnits(d('2026-11-07T09:00:00Z'), d('2026-11-08T17:00:00Z'), 'per_kalenderdag')).toHaveLength(2)
    // eindigt precies om middernacht: die dag telt niet mee
    expect(rentalDayUnits(d('2026-11-07T09:00:00Z'), d('2026-11-07T23:00:00Z'), 'per_kalenderdag')).toHaveLength(1)
  })

  it('blijft correct over de overgang naar wintertijd', () => {
    // 24 oktober 10:00 CEST tot 26 oktober 10:00 CET = 49 uur werkelijke tijd
    const units = rentalDayUnits(d('2026-10-24T08:00:00Z'), d('2026-10-26T09:00:00Z'), 'per_24_uur')
    expect(units).toHaveLength(3)
    expect(rentalDayUnits(d('2026-10-24T08:00:00Z'), d('2026-10-26T09:00:00Z'), 'per_kalenderdag')).toHaveLength(3)
  })
})

describe('prijsberekening', () => {
  it('rekent niets uit zolang de regels niet bevestigd zijn', () => {
    expect(
      calculateQuote({ start: d('2026-11-07T09:00:00Z'), end: d('2026-11-09T09:00:00Z'), rate, rules: DEFAULT_PRICING_RULES, promotions: [] }),
    ).toEqual({ kind: 'indicatie', reason: 'regels_onbevestigd' })
  })

  it('rekent dagen × dagprijs en houdt de borg apart', () => {
    const q = calculateQuote({ start: d('2026-11-04T09:00:00Z'), end: d('2026-11-06T09:00:00Z'), rate, rules: confirmedRules, promotions: [] })
    expect(q).toMatchObject({ kind: 'berekend', days: 2, rentalCents: 80_000, totalCents: 80_000, depositCents: 200_000 })
  })

  it('gebruikt het weekendtarief alleen als het is ingevuld', () => {
    const withWeekend: RateCard = { ...rate, weekendRateCents: 45_000 }
    // vr 10:00 – zo 10:00 lokaal: blokken starten vr en za
    const q = calculateQuote({ start: d('2026-11-06T09:00:00Z'), end: d('2026-11-08T09:00:00Z'), rate: withWeekend, rules: confirmedRules, promotions: [] })
    expect(q.kind === 'berekend' && q.rentalCents).toBe(85_000)
  })

  it('kiest het weektarief als dat voordeliger is', () => {
    const withWeek: RateCard = { ...rate, weekRateCents: 240_000 }
    const q = calculateQuote({ start: d('2026-11-02T09:00:00Z'), end: d('2026-11-10T09:00:00Z'), rate: withWeek, rules: confirmedRules, promotions: [] })
    expect(q).toMatchObject({ kind: 'berekend', days: 8, rentalCents: 280_000, usedWeekRate: true })
  })

  it('past acties per huurdag toe', () => {
    const p = promo({ startsAt: d('2026-11-05T00:00:00Z'), endsAt: d('2026-11-06T00:00:00Z') })
    const q = calculateQuote({ start: d('2026-11-04T09:00:00Z'), end: d('2026-11-06T09:00:00Z'), rate, rules: confirmedRules, promotions: [p] })
    expect(q.kind === 'berekend' && q.rentalCents).toBe(75_000)
  })

  it('rekent een kortingspercentage', () => {
    const p = promo({ kind: 'percentage', value: 10 })
    const q = calculateQuote({ start: d('2026-11-04T09:00:00Z'), end: d('2026-11-05T09:00:00Z'), rate, rules: confirmedRules, promotions: [p] })
    expect(q.kind === 'berekend' && q.rentalCents).toBe(36_000)
  })

  it('telt aanvullende kosten per huur en per dag', () => {
    const withExtras: RateCard = {
      ...rate,
      extraCosts: [
        { id: 'a', label: 'Schoonmaak', amountCents: 2_500, unit: 'per_huur' },
        { id: 'b', label: 'Extra bestuurder', amountCents: 1_000, unit: 'per_dag' },
      ],
    }
    const q = calculateQuote({ start: d('2026-11-04T09:00:00Z'), end: d('2026-11-06T09:00:00Z'), rate: withExtras, rules: confirmedRules, promotions: [] })
    expect(q).toMatchObject({ kind: 'berekend', rentalCents: 80_000, extrasCents: 4_500, totalCents: 84_500 })
  })
})

describe('controle van acties', () => {
  const dayRates = new Map<string, number | null>([
    ['rs3', 40_000],
    ['sq8', 60_000],
  ])
  const base = { kind: 'vaste_dagprijs' as const, value: 35_000, startsAt: d('2026-11-01T00:00:00Z'), endsAt: d('2026-11-30T00:00:00Z'), vehicleIds: ['rs3'] }

  it('accepteert een logische actie', () => {
    expect(checkPromotion(base, { dayRates, otherLivePromotions: [] })).toEqual([])
  })

  it('weigert een actieprijs boven de dagprijs', () => {
    const issues = checkPromotion({ ...base, value: 45_000 }, { dayRates, otherLivePromotions: [] })
    expect(issues.map((i) => i.field)).toContain('value')
  })

  it('weigert een omgekeerde periode en een lege selectie', () => {
    const issues = checkPromotion({ ...base, startsAt: base.endsAt, endsAt: base.startsAt, vehicleIds: [] }, { dayRates, otherLivePromotions: [] })
    expect(issues.map((i) => i.field).sort()).toEqual(['period', 'vehicles'])
  })

  it('signaleert overlap met een andere live actie voor dezelfde auto', () => {
    const issues = checkPromotion(base, {
      dayRates,
      otherLivePromotions: [{ id: 'x', title: 'Weekendactie', startsAt: d('2026-11-20T00:00:00Z'), endsAt: d('2026-12-05T00:00:00Z'), vehicleIds: ['rs3', 'sq8'] }],
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('Weekendactie')
  })

  it('weigert percentages buiten 1–90', () => {
    expect(checkPromotion({ ...base, kind: 'percentage', value: 95 }, { dayRates, otherLivePromotions: [] })).toHaveLength(1)
  })
})
