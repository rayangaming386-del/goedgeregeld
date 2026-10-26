/**
 * WhatsApp-links met nette, ingevulde tekst. Werkt zonder backend en is de
 * altijd beschikbare contactroute.
 */
import { formatDateTimeLong } from '@/domain/time'

export const DEFAULT_WHATSAPP_NUMBER = '31616161623'

export function whatsappUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '')
  const base = `https://wa.me/${digits}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export type WhatsAppRequestDetails = {
  vehicleName?: string | null
  start?: Date | null
  end?: Date | null
  name?: string | null
  reference?: string | null
  message?: string | null
}

/** Bericht voor een beschikbaarheidsvraag; laat lege onderdelen weg. */
export function availabilityMessage(d: WhatsAppRequestDetails): string {
  const lines: string[] = []
  lines.push(
    d.vehicleName
      ? `Hallo Goed Geregeld, ik wil graag de beschikbaarheid aanvragen voor de ${d.vehicleName}.`
      : 'Hallo Goed Geregeld, ik wil graag de beschikbaarheid van een auto aanvragen.',
  )
  if (d.start && d.end) {
    lines.push(`Gewenste periode: ${formatDateTimeLong(d.start)} tot ${formatDateTimeLong(d.end)}.`)
  } else {
    lines.push('Gewenste periode: ')
  }
  if (d.message) lines.push(d.message)
  if (d.name) lines.push(`Groet, ${d.name}`)
  if (d.reference) lines.push(`(Aanvraagnummer ${d.reference})`)
  return lines.join('\n')
}

/** Bericht van het bedrijf aan een klant, vanuit het beheer. */
export function customerMessage(d: { name: string; vehicleName: string; start: Date; end: Date; reference: string }): string {
  const first = d.name.split(' ')[0] ?? d.name
  return [
    `Hallo ${first},`,
    `Bedankt voor je aanvraag voor de ${d.vehicleName} (${d.reference}) van ${formatDateTimeLong(d.start)} tot ${formatDateTimeLong(d.end)}.`,
    '',
  ].join('\n')
}
