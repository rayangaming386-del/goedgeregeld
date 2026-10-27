'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { validateRequest, type FieldErrors, type RequestInput } from '@/domain/request-validation'
import { formatPeriod } from '@/domain/time'
import { absoluteUrl } from '@/lib/site'
import { getDb } from '@/server/db/client'
import { notifyNewRequest } from '@/server/mail'
import { isPreview, PREVIEW_REQUEST_MESSAGE } from '@/server/preview'
import { getPublishedVehicle } from '@/server/public/queries'
import { clientIp } from '@/server/client-ip'
import { hashKey, hitRateLimit } from '@/server/rate-limit'
import { createWebsiteRequest } from '@/server/reservations/service'

export type RequestState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: FieldErrors; message: string }
  | { status: 'limited'; message: string }
  | { status: 'error'; message: string }
  | { status: 'success'; reference: string; duplicate: boolean; vehicleName: string; start: string; end: string }

const GENERIC_ERROR =
  'Je aanvraag kon niet worden verstuurd. Er is niets opgeslagen. Probeer het opnieuw of stuur je aanvraag via WhatsApp.'

function field(fd: FormData, key: keyof RequestInput | 'website' | 'startedAt'): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.slice(0, 4000) : ''
}

/**
 * Publieke aanvraag. Meldt alleen succes als de aanvraag daadwerkelijk in de
 * database staat. Een aanvraag is geen reservering en blokkeert de auto niet.
 */
export async function submitRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  // Zonder database kan er niets worden opgeslagen: nooit een succesmelding.
  if (isPreview()) return { status: 'error', message: PREVIEW_REQUEST_MESSAGE }
  // Spam: een verborgen veld dat mensen niet zien, en een minimale invultijd.
  if (field(formData, 'website')) return { status: 'error', message: GENERIC_ERROR }
  const startedAt = Number(field(formData, 'startedAt'))
  if (startedAt && Date.now() - startedAt < 2500) return { status: 'error', message: GENERIC_ERROR }

  const raw: RequestInput = {
    vehicle: field(formData, 'vehicle'),
    startDate: field(formData, 'startDate'),
    startTime: field(formData, 'startTime'),
    endDate: field(formData, 'endDate'),
    endTime: field(formData, 'endTime'),
    name: field(formData, 'name'),
    phone: field(formData, 'phone'),
    email: field(formData, 'email'),
    message: field(formData, 'message'),
  }
  const result = validateRequest(raw, new Date())
  if (!result.ok) return { status: 'invalid', errors: result.errors, message: 'Controleer de gemarkeerde velden.' }

  try {
    const db = getDb()
    // Zelfde zichtbaarheidsregels als de website (status en, live, fotorechten).
    const vehicle = await getPublishedVehicle(result.value.vehicle)
    if (!vehicle) {
      return { status: 'invalid', errors: { vehicle: 'Kies een auto uit het wagenpark.' }, message: 'Controleer de gemarkeerde velden.' }
    }

    const h = await headers()
    const ip = clientIp(h)
    const ipKey = hashKey(`ip:${ip}`)
    const burst = await hitRateLimit(db, `aanvraag:10m:${ipKey}`, 5, 600)
    const daily = await hitRateLimit(db, `aanvraag:24h:${ipKey}`, 20, 86_400)
    if (!burst.allowed || !daily.allowed) {
      return {
        status: 'limited',
        message: 'Je hebt kort na elkaar meerdere aanvragen verstuurd. Probeer het over een paar minuten opnieuw, of stuur een WhatsApp.',
      }
    }

    const created = await createWebsiteRequest({ vehicleId: vehicle.id, ...result.value }, db)
    if (created.kind === 'created') {
      const { start, end } = result.value
      after(async () => {
        await notifyNewRequest({
          reference: created.reference,
          vehicleName: vehicle.name,
          period: formatPeriod(start, end),
          adminUrl: absoluteUrl(`/beheer/aanvragen/${created.id}`),
        })
      })
    }
    return {
      status: 'success',
      reference: created.reference,
      duplicate: created.kind === 'duplicate',
      vehicleName: vehicle.name,
      start: result.value.start.toISOString(),
      end: result.value.end.toISOString(),
    }
  } catch (err) {
    // Geen persoonsgegevens in logs.
    console.error('[aanvraag] opslaan mislukt:', err instanceof Error ? err.name : 'onbekende fout')
    return { status: 'error', message: GENERIC_ERROR }
  }
}
