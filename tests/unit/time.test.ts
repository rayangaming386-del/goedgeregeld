import { describe, expect, it } from 'vitest'
import {
  addDaysToDateKey,
  formatDateTimeShort,
  formatDuration,
  isValidDateString,
  localDateKey,
  localToUtc,
  startOfLocalDay,
  toLocalInputValues,
  toLocalParts,
} from '@/domain/time'

function utc(r: ReturnType<typeof localToUtc>): string {
  if (!r.ok) throw new Error(`verwacht ok, kreeg ${r.reason}`)
  return r.instant.toISOString()
}

describe('localToUtc (Europe/Amsterdam)', () => {
  it('rekent wintertijd om (UTC+1)', () => {
    expect(utc(localToUtc('2026-11-07', '10:00'))).toBe('2026-11-07T09:00:00.000Z')
  })

  it('rekent zomertijd om (UTC+2)', () => {
    expect(utc(localToUtc('2026-07-01', '10:00'))).toBe('2026-07-01T08:00:00.000Z')
  })

  it('weigert een tijdstip dat door de overgang naar zomertijd niet bestaat', () => {
    expect(localToUtc('2026-03-29', '02:30')).toEqual({ ok: false, reason: 'bestaat_niet' })
    expect(utc(localToUtc('2026-03-29', '01:59'))).toBe('2026-03-29T00:59:00.000Z')
    expect(utc(localToUtc('2026-03-29', '03:00'))).toBe('2026-03-29T01:00:00.000Z')
  })

  it('kiest bij de overgang naar wintertijd het eerste (zomertijd)moment', () => {
    // 02:30 komt op 25 oktober 2026 twee keer voor: 00:30Z (CEST) en 01:30Z (CET).
    expect(utc(localToUtc('2026-10-25', '02:30'))).toBe('2026-10-25T00:30:00.000Z')
    expect(utc(localToUtc('2026-10-25', '03:00'))).toBe('2026-10-25T02:00:00.000Z')
  })

  it('weigert ongeldige datums en tijden', () => {
    expect(localToUtc('2026-02-30', '10:00')).toEqual({ ok: false, reason: 'ongeldige_datum' })
    expect(localToUtc('2026-13-01', '10:00')).toEqual({ ok: false, reason: 'ongeldige_datum' })
    expect(localToUtc('2026-11-07', '24:00')).toEqual({ ok: false, reason: 'ongeldige_tijd' })
    expect(localToUtc('2026-11-07', '9:00')).toEqual({ ok: false, reason: 'ongeldige_tijd' })
    expect(localToUtc('07-11-2026', '10:00')).toEqual({ ok: false, reason: 'ongeldige_datum' })
  })

  it('accepteert schrikkeldagen alleen in schrikkeljaren', () => {
    expect(isValidDateString('2028-02-29')).toBe(true)
    expect(isValidDateString('2026-02-29')).toBe(false)
  })
})

describe('lokale weergave en hulpfuncties', () => {
  it('geeft lokale onderdelen inclusief weekdag', () => {
    const p = toLocalParts(new Date('2026-11-07T09:00:00Z'))
    expect(p).toMatchObject({ year: 2026, month: 11, day: 7, hour: 10, minute: 0, weekday: 6 })
  })

  it('maakt invoerwaarden die terug te rekenen zijn', () => {
    const instant = new Date('2026-07-15T16:45:00Z')
    const v = toLocalInputValues(instant)
    expect(v).toEqual({ date: '2026-07-15', time: '18:45' })
    expect(utc(localToUtc(v.date, v.time))).toBe(instant.toISOString())
  })

  it('bepaalt de lokale datum rond middernacht correct', () => {
    expect(localDateKey(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08')
    expect(localDateKey(new Date('2026-07-07T22:30:00Z'))).toBe('2026-07-08')
  })

  it('telt kalenderdagen op over de DST-grens heen', () => {
    expect(addDaysToDateKey('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(startOfLocalDay('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z')
    expect(startOfLocalDay('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
  })

  it('formatteert in het Nederlands', () => {
    expect(formatDateTimeShort(new Date('2026-11-07T09:00:00Z'))).toBe('za 7 nov 2026, 10:00')
    expect(formatDuration(new Date('2026-11-07T09:00:00Z'), new Date('2026-11-09T17:00:00Z'))).toBe('2 dagen en 8 uur')
  })
})
