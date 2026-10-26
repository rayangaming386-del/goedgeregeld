import { describe, expect, it } from 'vitest'
import { blockingItems, findConflicts, overlaps, requestWarnings, type ReservationLike } from '@/domain/availability'
import { ALLOWED_TRANSITIONS, canTransition, isActiveOption, planningKind, RESERVATION_STATUSES } from '@/domain/reservation-status'

const d = (iso: string) => new Date(iso)
const now = d('2026-11-01T12:00:00Z')

function res(partial: Partial<ReservationLike> & Pick<ReservationLike, 'id' | 'start' | 'end'>): ReservationLike {
  return { reference: `GG-${partial.id}`, status: 'nieuw', optionExpiresAt: null, ...partial }
}

describe('overlap (half-open perioden)', () => {
  const a = { start: d('2026-11-07T09:00:00Z'), end: d('2026-11-08T17:00:00Z') }

  it('herkent overlap', () => {
    expect(overlaps(a, { start: d('2026-11-08T09:00:00Z'), end: d('2026-11-09T09:00:00Z') })).toBe(true)
    expect(overlaps(a, { start: d('2026-11-06T09:00:00Z'), end: d('2026-11-10T09:00:00Z') })).toBe(true)
  })

  it('aansluitende perioden overlappen niet', () => {
    expect(overlaps(a, { start: d('2026-11-08T17:00:00Z'), end: d('2026-11-09T09:00:00Z') })).toBe(false)
    expect(overlaps(a, { start: d('2026-11-06T09:00:00Z'), end: d('2026-11-07T09:00:00Z') })).toBe(false)
  })
})

describe('blokkerende items', () => {
  const reservations = [
    res({ id: 'aanvraag', start: d('2026-11-07T09:00:00Z'), end: d('2026-11-08T09:00:00Z') }),
    res({ id: 'bevestigd', status: 'bevestigd', start: d('2026-11-10T09:00:00Z'), end: d('2026-11-12T09:00:00Z') }),
    res({
      id: 'optie',
      status: 'in_behandeling',
      optionExpiresAt: d('2026-11-03T12:00:00Z'),
      start: d('2026-11-14T09:00:00Z'),
      end: d('2026-11-15T09:00:00Z'),
    }),
    res({
      id: 'verlopen-optie',
      status: 'wacht_op_klant',
      optionExpiresAt: d('2026-10-30T12:00:00Z'),
      start: d('2026-11-16T09:00:00Z'),
      end: d('2026-11-17T09:00:00Z'),
    }),
    res({ id: 'geannuleerd', status: 'geannuleerd', start: d('2026-11-18T09:00:00Z'), end: d('2026-11-19T09:00:00Z') }),
  ]
  const blocks = [
    { id: 'onderhoud', kind: 'onderhoud' as const, reason: 'APK', start: d('2026-11-20T08:00:00Z'), end: d('2026-11-20T16:00:00Z') },
  ]

  it('telt alleen bevestigd, actieve opties en blokkades', () => {
    const items = blockingItems(reservations, blocks, now)
    expect(items.map((i) => `${i.kind}:${i.id}`).sort()).toEqual(['bevestigd:bevestigd', 'onderhoud:onderhoud', 'optie:optie'])
  })

  it('een losse aanvraag blokkeert niet', () => {
    const items = blockingItems(reservations, blocks, now)
    expect(findConflicts({ start: d('2026-11-07T10:00:00Z'), end: d('2026-11-07T12:00:00Z') }, items)).toEqual([])
  })

  it('vindt conflicten en sluit de eigen reservering uit', () => {
    const period = { start: d('2026-11-11T09:00:00Z'), end: d('2026-11-14T10:00:00Z') }
    const all = findConflicts(period, blockingItems(reservations, blocks, now))
    expect(all.map((c) => c.id)).toEqual(['bevestigd', 'optie'])
    const own = findConflicts(period, blockingItems(reservations, blocks, now, { excludeReservationId: 'bevestigd' }))
    expect(own.map((c) => c.id)).toEqual(['optie'])
  })

  it('een verlopen optie blokkeert niet meer', () => {
    const items = blockingItems(reservations, blocks, now)
    expect(findConflicts({ start: d('2026-11-16T10:00:00Z'), end: d('2026-11-16T12:00:00Z') }, items)).toEqual([])
  })

  it('geeft waarschuwingen voor aanvragen die met iets blokkerends samenvallen', () => {
    const overlapping = res({ id: 'nieuw2', start: d('2026-11-11T09:00:00Z'), end: d('2026-11-11T18:00:00Z') })
    const warnings = requestWarnings([overlapping], blockingItems(reservations, blocks, now))
    expect(warnings.get('nieuw2')?.map((w) => w.id)).toEqual(['bevestigd'])
  })
})

describe('statusovergangen', () => {
  it('staat de normale route toe', () => {
    expect(canTransition('nieuw', 'in_behandeling')).toBe(true)
    expect(canTransition('in_behandeling', 'wacht_op_klant')).toBe(true)
    expect(canTransition('wacht_op_klant', 'bevestigd')).toBe(true)
    expect(canTransition('bevestigd', 'afgerond')).toBe(true)
  })

  it('weigert onlogische overgangen', () => {
    expect(canTransition('afgerond', 'bevestigd')).toBe(false)
    expect(canTransition('bevestigd', 'nieuw')).toBe(false)
    expect(canTransition('nieuw', 'afgerond')).toBe(false)
    expect(canTransition('afgewezen', 'bevestigd')).toBe(false)
  })

  it('kan afgewezen en geannuleerd heropenen', () => {
    expect(canTransition('afgewezen', 'in_behandeling')).toBe(true)
    expect(canTransition('geannuleerd', 'in_behandeling')).toBe(true)
  })

  it('heeft voor elke status een definitie zonder zelfovergang', () => {
    for (const s of RESERVATION_STATUSES) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined()
      expect(ALLOWED_TRANSITIONS[s]).not.toContain(s)
    }
  })

  it('classificeert opties en aanvragen', () => {
    expect(planningKind({ status: 'nieuw', optionExpiresAt: null }, now)).toBe('aanvraag')
    expect(planningKind({ status: 'nieuw', optionExpiresAt: d('2026-11-02T00:00:00Z') }, now)).toBe('optie')
    expect(planningKind({ status: 'nieuw', optionExpiresAt: d('2026-10-31T00:00:00Z') }, now)).toBe('aanvraag')
    expect(planningKind({ status: 'bevestigd', optionExpiresAt: null }, now)).toBe('bevestigd')
    expect(isActiveOption({ status: 'afgewezen', optionExpiresAt: d('2026-11-02T00:00:00Z') }, now)).toBe(false)
  })
})
