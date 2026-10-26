'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fail, done, type ActionState } from '@/components/admin/action-state'
import { BLOCKING_LABELS, type BlockingItem } from '@/domain/availability'
import { isReservationStatus, STATUS_LABELS } from '@/domain/reservation-status'
import { isPlausiblePhone } from '@/domain/request-validation'
import { formatPeriod, localToUtc } from '@/domain/time'
import { actionUser } from '@/server/auth/session'
import {
  addNote,
  changeStatus,
  ConflictError,
  createManual,
  NotFoundError,
  setOption,
  TransitionError,
  updateCustomer,
  updatePeriod,
} from '@/server/reservations/service'

const NO_ACCESS = 'Je hebt geen rechten om aanvragen te beheren.'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function describeConflicts(conflicts: BlockingItem[]): Promise<string> {
  if (!conflicts.length) return 'De periode overlapt met een andere bevestigde reservering.'
  return `Overlapt met: ${conflicts
    .map((c) => `${BLOCKING_LABELS[c.kind]} ${c.kind === 'bevestigd' || c.kind === 'optie' ? c.label : `(${c.label})`}, ${formatPeriod(c.start, c.end)}`)
    .join('; ')}.`
}

async function handleError(err: unknown): Promise<ActionState> {
  if (err instanceof ConflictError) return fail(await describeConflicts(err.conflicts))
  if (err instanceof TransitionError || err instanceof NotFoundError) return fail(err.message)
  console.error('[beheer] actie mislukt:', err instanceof Error ? err.name : 'onbekend')
  return fail('Er ging iets mis bij het opslaan. Probeer het opnieuw.')
}

function readPeriod(fd: FormData, prefix = ''): { ok: true; start: Date; end: Date } | { ok: false; errors: Record<string, string> } {
  const s = localToUtc(str(fd, `${prefix}startDate`), str(fd, `${prefix}startTime`))
  const e = localToUtc(str(fd, `${prefix}endDate`), str(fd, `${prefix}endTime`))
  const errors: Record<string, string> = {}
  if (!s.ok) errors.startDate = s.reason === 'bestaat_niet' ? 'Dit tijdstip bestaat niet (overgang zomertijd).' : 'Vul een geldige begindatum en -tijd in.'
  if (!e.ok) errors.endDate = e.reason === 'bestaat_niet' ? 'Dit tijdstip bestaat niet (overgang zomertijd).' : 'Vul een geldige einddatum en -tijd in.'
  if (s.ok && e.ok && e.instant.getTime() <= s.instant.getTime()) errors.endDate = 'Het einde moet na het begin liggen.'
  if (Object.keys(errors).length || !s.ok || !e.ok) return { ok: false, errors }
  return { ok: true, start: s.instant, end: e.instant }
}

export async function changeStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'reservationId')
  const to = str(fd, 'to')
  if (!isReservationStatus(to)) return fail('Onbekende status.')
  try {
    await changeStatus({ reservationId: id, to, actor: user })
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  return done(`Status gewijzigd naar “${STATUS_LABELS[to]}”.`)
}

export async function setOptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'reservationId')
  const clear = str(fd, 'intent') === 'verwijderen'
  let expiresAt: Date | null = null
  if (!clear) {
    const r = localToUtc(str(fd, 'optionDate'), str(fd, 'optionTime') || '18:00')
    if (!r.ok) return fail('Controleer de vervaldatum.', { optionDate: 'Vul een geldige datum en tijd in.' })
    expiresAt = r.instant
  }
  try {
    await setOption({ reservationId: id, expiresAt, actor: user })
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  return done(clear ? 'Tijdelijke optie verwijderd.' : 'Tijdelijke optie gezet. De auto is tot de vervaldatum vastgehouden.')
}

export async function updatePeriodAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  const period = readPeriod(fd)
  if (!period.ok) return fail('Controleer de periode.', period.errors)
  try {
    await updatePeriod({
      reservationId: str(fd, 'reservationId'),
      start: period.start,
      end: period.end,
      vehicleId: str(fd, 'vehicleId') || undefined,
      actor: user,
    })
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  return done('Periode bijgewerkt.')
}

export async function updateCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  const name = str(fd, 'name')
  const phone = str(fd, 'phone')
  const email = str(fd, 'email')
  const errors: Record<string, string> = {}
  if (name.length < 2) errors.name = 'Vul een naam in.'
  if (!isPlausiblePhone(phone)) errors.phone = 'Controleer het telefoonnummer.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Controleer het e-mailadres.'
  if (Object.keys(errors).length) return fail('Controleer de velden.', errors)
  try {
    await updateCustomer({ reservationId: str(fd, 'reservationId'), name: name.slice(0, 80), phone: phone.slice(0, 24), email: email || null, actor: user })
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  return done('Klantgegevens bijgewerkt.')
}

export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  try {
    await addNote({ reservationId: str(fd, 'reservationId'), body: str(fd, 'body'), actor: user })
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  return done('Notitie toegevoegd.')
}

export async function createManualAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('aanvragen:beheren')
  if (!user) return fail(NO_ACCESS)
  const errors: Record<string, string> = {}
  const vehicleId = str(fd, 'vehicleId')
  const name = str(fd, 'name')
  const phone = str(fd, 'phone')
  const email = str(fd, 'email')
  const status = str(fd, 'status')
  const source = str(fd, 'source')
  if (!vehicleId) errors.vehicleId = 'Kies een auto.'
  if (name.length < 2) errors.name = 'Vul een naam in.'
  if (!isPlausiblePhone(phone)) errors.phone = 'Controleer het telefoonnummer.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Controleer het e-mailadres.'
  const period = readPeriod(fd)
  if (!period.ok) Object.assign(errors, period.errors)
  if (!['nieuw', 'in_behandeling', 'bevestigd'].includes(status)) errors.status = 'Kies een status.'
  if (!['whatsapp', 'telefoon', 'instagram', 'handmatig'].includes(source)) errors.source = 'Kies een bron.'
  let optionExpiresAt: Date | null = null
  if (str(fd, 'optionDate')) {
    const r = localToUtc(str(fd, 'optionDate'), str(fd, 'optionTime') || '18:00')
    if (!r.ok) errors.optionDate = 'Vul een geldige vervaldatum in.'
    else optionExpiresAt = r.instant
  }
  if (Object.keys(errors).length || !period.ok) return fail('Controleer de gemarkeerde velden.', errors)
  let id: string
  try {
    const row = await createManual({
      vehicleId,
      start: period.start,
      end: period.end,
      name: name.slice(0, 80),
      phone: phone.slice(0, 24),
      email: email || null,
      message: str(fd, 'message').slice(0, 1000) || null,
      source: source as 'whatsapp' | 'telefoon' | 'instagram' | 'handmatig',
      status: status as 'nieuw' | 'in_behandeling' | 'bevestigd',
      optionExpiresAt,
      actor: user,
    })
    id = row.id
  } catch (err) {
    return handleError(err)
  }
  revalidatePath('/beheer', 'layout')
  redirect(`/beheer/aanvragen/${id}`)
}
