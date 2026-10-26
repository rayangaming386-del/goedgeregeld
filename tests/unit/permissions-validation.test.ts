import { describe, expect, it } from 'vitest'
import { can, PERMISSIONS, ROLES } from '@/domain/permissions'
import { isPlausiblePhone, normalizePhone, phoneForWhatsApp, validatePeriod, validateRequest } from '@/domain/request-validation'
import { parseEuroToCents } from '@/lib/format'
import { isValidSlug, slugify } from '@/lib/slug'
import { availabilityMessage, whatsappUrl } from '@/lib/whatsapp'

describe('rechten', () => {
  it('eigenaar mag alles', () => {
    for (const p of PERMISSIONS) expect(can('eigenaar', p)).toBe(true)
  })

  it('medewerker beheert aanvragen en planning, maar geen prijzen, inhoud of gebruikers', () => {
    expect(can('medewerker', 'aanvragen:beheren')).toBe(true)
    expect(can('medewerker', 'planning:beheren')).toBe(true)
    expect(can('medewerker', 'prijzen:beheren')).toBe(false)
    expect(can('medewerker', 'inhoud:beheren')).toBe(false)
    expect(can('medewerker', 'gebruikers:beheren')).toBe(false)
    expect(can('medewerker', 'wagenpark:bewerken')).toBe(false)
  })

  it('redacteur beheert auto’s, foto’s en inhoud, maar geen aanvragen of prijzen', () => {
    expect(can('redacteur', 'wagenpark:bewerken')).toBe(true)
    expect(can('redacteur', 'media:beheren')).toBe(true)
    expect(can('redacteur', 'inhoud:beheren')).toBe(true)
    expect(can('redacteur', 'aanvragen:bekijken')).toBe(false)
    expect(can('redacteur', 'prijzen:beheren')).toBe(false)
    expect(can('redacteur', 'brongegevens:bevestigen')).toBe(false)
  })

  it('zonder rol geen rechten', () => {
    expect(can(null, 'dashboard:bekijken')).toBe(false)
    expect(ROLES).toHaveLength(3)
  })
})

describe('aanvraagvalidatie', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  const valid = {
    vehicle: 'audi-rs3-sportback',
    startDate: '2026-11-07',
    startTime: '10:00',
    endDate: '2026-11-08',
    endTime: '18:00',
    name: '  Sam   de Vries ',
    phone: '06 12345678',
    email: '',
    message: '',
  }

  it('accepteert een geldige aanvraag en normaliseert invoer', () => {
    const r = validateRequest(valid, now)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('Sam de Vries')
      expect(r.value.start.toISOString()).toBe('2026-11-07T09:00:00.000Z')
      expect(r.value.email).toBeNull()
    }
  })

  it('weigert een eindtijd vóór de begintijd', () => {
    const r = validatePeriod({ ...valid, endDate: '2026-11-07', endTime: '09:00' }, now)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.endDate).toMatch(/na het begin/)
  })

  it('weigert gelijke begin- en eindtijd', () => {
    const r = validatePeriod({ ...valid, endDate: '2026-11-07', endTime: '10:00' }, now)
    expect(r.ok).toBe(false)
  })

  it('weigert een begin in het verleden', () => {
    const r = validatePeriod({ ...valid, startDate: '2026-10-30' }, now)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.startDate).toMatch(/verleden/)
  })

  it('weigert niet-bestaande datums en DST-gaten', () => {
    const r1 = validatePeriod({ ...valid, startDate: '2026-11-31' }, now)
    expect(r1.ok === false && r1.errors.startDate).toBe('Deze datum bestaat niet.')
    const spring = new Date('2027-03-01T12:00:00Z')
    const r2 = validatePeriod({ ...valid, startDate: '2027-03-28', startTime: '02:30', endDate: '2027-03-29', endTime: '10:00' }, spring)
    expect(r2.ok === false && r2.errors.startTime).toMatch(/zomertijd/)
  })

  it('controleert telefoon en e-mail', () => {
    const r = validateRequest({ ...valid, phone: '12', email: 'geen-mail' }, now)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.phone).toBeDefined()
      expect(r.errors.email).toBeDefined()
    }
  })

  it('herkent gangbare telefoonnotaties', () => {
    expect(isPlausiblePhone('06-12345678')).toBe(true)
    expect(isPlausiblePhone('+31 6 1234 5678')).toBe(true)
    expect(isPlausiblePhone('0031612345678')).toBe(true)
    expect(isPlausiblePhone('612345678')).toBe(false)
    expect(isPlausiblePhone('06 1234 abcd')).toBe(false)
    expect(normalizePhone('0031 6 12345678')).toBe('+31612345678')
    expect(phoneForWhatsApp('06 12345678')).toBe('31612345678')
    expect(phoneForWhatsApp('+49 151 2345678')).toBe('491512345678')
  })
})

describe('hulpfuncties', () => {
  it('maakt nette slugs', () => {
    expect(slugify('Audi SQ8 (700PK) + Downpipe')).toBe('audi-sq8-700pk-downpipe')
    expect(slugify('Één café & co')).toBe('een-cafe-en-co')
    expect(isValidSlug('audi-rs3')).toBe(true)
    expect(isValidSlug('Audi RS3')).toBe(false)
    expect(isValidSlug('-rs3')).toBe(false)
  })

  it('leest euro-invoer', () => {
    expect(parseEuroToCents('400')).toBe(40_000)
    expect(parseEuroToCents('€ 2.500')).toBe(250_000)
    expect(parseEuroToCents('399,50')).toBe(39_950)
    expect(parseEuroToCents('12.5')).toBe(1_250)
    expect(parseEuroToCents('abc')).toBeNull()
    expect(parseEuroToCents('')).toBeNull()
  })

  it('bouwt een WhatsApp-bericht met de gekozen auto en periode', () => {
    const text = availabilityMessage({
      vehicleName: 'Audi RS3 Sportback',
      start: new Date('2026-11-07T09:00:00Z'),
      end: new Date('2026-11-08T17:00:00Z'),
      name: 'Sam',
    })
    expect(text).toContain('Audi RS3 Sportback')
    expect(text).toContain('zaterdag 7 november 2026 om 10:00')
    expect(text).toContain('zondag 8 november 2026 om 18:00')
    const url = whatsappUrl('+31 6 16161623', text)
    expect(url.startsWith('https://wa.me/31616161623?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe(text)
  })
})
