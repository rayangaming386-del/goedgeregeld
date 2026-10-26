'use server'

import { revalidatePath } from 'next/cache'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { localToUtc } from '@/domain/time'
import { actionUser } from '@/server/auth/session'
import { ConflictError, createBlock, deleteBlock, TransitionError } from '@/server/reservations/service'
import { describeConflicts } from '../aanvragen/actions'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function createBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('planning:beheren')
  if (!user) return fail('Je hebt geen rechten om de planning te beheren.')
  const errors: Record<string, string> = {}
  const vehicleId = str(fd, 'vehicleId')
  const kind = str(fd, 'kind')
  if (!vehicleId) errors.vehicleId = 'Kies een auto.'
  if (kind !== 'onderhoud' && kind !== 'blokkade') errors.kind = 'Kies een soort.'
  const s = localToUtc(str(fd, 'startDate'), str(fd, 'startTime') || '00:00')
  const e = localToUtc(str(fd, 'endDate'), str(fd, 'endTime') || '23:59')
  if (!s.ok) errors.startDate = 'Vul een geldig begin in.'
  if (!e.ok) errors.endDate = 'Vul een geldig einde in.'
  if (s.ok && e.ok && e.instant <= s.instant) errors.endDate = 'Het einde moet na het begin liggen.'
  if (Object.keys(errors).length || !s.ok || !e.ok) return fail('Controleer de gemarkeerde velden.', errors)
  try {
    await createBlock({ vehicleId, kind: kind as 'onderhoud' | 'blokkade', start: s.instant, end: e.instant, reason: str(fd, 'reason'), actor: user })
  } catch (err) {
    if (err instanceof ConflictError) return fail(`Blokkade niet opgeslagen. ${await describeConflicts(err.conflicts)}`)
    if (err instanceof TransitionError) return fail(err.message)
    return fail('Er ging iets mis bij het opslaan.')
  }
  revalidatePath('/beheer', 'layout')
  return done('Blokkade toegevoegd.')
}

export async function deleteBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('planning:beheren')
  if (!user) return fail('Je hebt geen rechten om de planning te beheren.')
  await deleteBlock({ blockId: str(fd, 'blockId'), actor: user })
  revalidatePath('/beheer', 'layout')
  return done('Blokkade verwijderd.')
}
