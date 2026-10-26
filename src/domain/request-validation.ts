/**
 * Validatie van een beschikbaarheidsaanvraag. Wordt zowel in de browser
 * (directe feedback) als op de server (leidend) gebruikt.
 */
import { localToUtc } from './time'

export type RequestInput = {
  vehicle: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  name: string
  phone: string
  email: string
  message: string
}

export type RequestField = keyof RequestInput
export type FieldErrors = Partial<Record<RequestField, string>>

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 120,
  messageMax: 1000,
  /** Sanity-grenzen tegen onzinnige invoer; geen huurvoorwaarden. */
  maxDaysAhead: 550,
  maxRentalDays: 120,
} as const

export const MAX_PHONE_DIGITS = 15

/** Normaliseert een telefoonnummer naar cijfers met optionele +. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const plus = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)
  return plus ? `+${digits}` : digits
}

export function isPlausiblePhone(raw: string): boolean {
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return false
  const n = normalizePhone(raw)
  const digits = n.replace('+', '')
  if (digits.length < 9 || digits.length > MAX_PHONE_DIGITS) return false
  // Nederlands nummer zonder landcode begint met 0.
  if (!n.startsWith('+') && !n.startsWith('0')) return false
  return true
}

/** Telefoonnummer in internationaal formaat voor WhatsApp (zonder +). */
export function phoneForWhatsApp(raw: string): string | null {
  const n = normalizePhone(raw)
  if (n.startsWith('+')) return n.slice(1)
  if (n.startsWith('0') && n.length >= 10) return `31${n.slice(1)}`
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type PeriodResult =
  | { ok: true; start: Date; end: Date }
  | { ok: false; errors: FieldErrors }

/** Datum- en tijdcontrole in Europe/Amsterdam. */
export function validatePeriod(
  input: Pick<RequestInput, 'startDate' | 'startTime' | 'endDate' | 'endTime'>,
  now: Date,
): PeriodResult {
  const errors: FieldErrors = {}
  if (!input.startDate) errors.startDate = 'Kies een begindatum.'
  if (!input.startTime) errors.startTime = 'Kies een begintijd.'
  if (!input.endDate) errors.endDate = 'Kies een einddatum.'
  if (!input.endTime) errors.endTime = 'Kies een eindtijd.'
  if (Object.keys(errors).length) return { ok: false, errors }

  const start = localToUtc(input.startDate, input.startTime)
  const end = localToUtc(input.endDate, input.endTime)

  if (!start.ok) {
    if (start.reason === 'ongeldige_datum') errors.startDate = 'Deze datum bestaat niet.'
    else if (start.reason === 'ongeldige_tijd') errors.startTime = 'Vul een tijd in als 10:00.'
    else errors.startTime = 'Dit tijdstip bestaat niet door de overgang naar zomertijd. Kies een ander tijdstip.'
  }
  if (!end.ok) {
    if (end.reason === 'ongeldige_datum') errors.endDate = 'Deze datum bestaat niet.'
    else if (end.reason === 'ongeldige_tijd') errors.endTime = 'Vul een tijd in als 18:00.'
    else errors.endTime = 'Dit tijdstip bestaat niet door de overgang naar zomertijd. Kies een ander tijdstip.'
  }
  if (!start.ok || !end.ok) return { ok: false, errors }

  const s = start.instant
  const e = end.instant
  if (s.getTime() < now.getTime() - 5 * 60_000) {
    errors.startDate = 'De begindatum ligt in het verleden.'
  } else if (s.getTime() > now.getTime() + LIMITS.maxDaysAhead * 86_400_000) {
    errors.startDate = 'Kies een begindatum binnen anderhalf jaar.'
  }
  if (e.getTime() <= s.getTime()) {
    errors.endDate = 'Het einde moet na het begin liggen.'
  } else if (e.getTime() - s.getTime() > LIMITS.maxRentalDays * 86_400_000) {
    errors.endDate = 'Neem voor een periode langer dan vier maanden direct contact op.'
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, start: s, end: e }
}

export type ValidRequest = {
  vehicle: string
  start: Date
  end: Date
  name: string
  phone: string
  email: string | null
  message: string | null
}

export function validateRequest(
  raw: RequestInput,
  now: Date,
): { ok: true; value: ValidRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const name = raw.name.trim().replace(/\s+/g, ' ')
  const phone = raw.phone.trim()
  const email = raw.email.trim()
  const message = raw.message.trim()

  if (!raw.vehicle) errors.vehicle = 'Kies een auto.'
  if (name.length < LIMITS.nameMin) errors.name = 'Vul je naam in.'
  else if (name.length > LIMITS.nameMax) errors.name = `Gebruik maximaal ${LIMITS.nameMax} tekens.`
  if (!phone) errors.phone = 'Vul je telefoonnummer in.'
  else if (!isPlausiblePhone(phone)) errors.phone = 'Controleer je telefoonnummer, bijvoorbeeld 06 12345678.'
  if (email && (email.length > LIMITS.emailMax || !EMAIL_RE.test(email))) {
    errors.email = 'Controleer je e-mailadres of laat het veld leeg.'
  }
  if (message.length > LIMITS.messageMax) errors.message = `Gebruik maximaal ${LIMITS.messageMax} tekens.`

  const period = validatePeriod(raw, now)
  if (!period.ok) Object.assign(errors, period.errors)

  if (Object.keys(errors).length || !period.ok) return { ok: false, errors }
  return {
    ok: true,
    value: {
      vehicle: raw.vehicle,
      start: period.start,
      end: period.end,
      name,
      phone,
      email: email || null,
      message: message || null,
    },
  }
}
