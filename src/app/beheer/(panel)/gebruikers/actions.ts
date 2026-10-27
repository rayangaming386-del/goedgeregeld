'use server'

import { revalidatePath } from 'next/cache'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { isRole } from '@/domain/permissions'
import { actionUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { changeRole, inviteUser, renameUser, resetUserPassword, setUserActive, UserAdminError } from '@/server/users/service'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

async function run(task: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await task()
  } catch (err) {
    if (err instanceof UserAdminError) return fail(err.message)
    throw err
  }
}

export async function inviteUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await actionUser('gebruikers:beheren')
  if (!owner) return fail('Alleen de eigenaar kan accounts beheren.')
  const email = str(fd, 'email')
  const name = str(fd, 'name')
  const role = str(fd, 'role')
  const errors: Record<string, string> = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) errors.email = 'Vul een geldig e-mailadres in.'
  if (name.length < 2 || name.length > 80) errors.name = 'Gebruik een naam van 2 tot 80 tekens.'
  if (!isRole(role)) errors.role = 'Kies een rol.'
  if (Object.keys(errors).length || !isRole(role)) return fail('Controleer de velden.', errors)
  return run(async () => {
    const { user, temporaryPassword } = await inviteUser(getDb(), { email, name, role }, owner.id)
    revalidatePath('/beheer/gebruikers')
    return done(`Account aangemaakt voor ${user.email}.`, { label: `Tijdelijk wachtwoord voor ${user.email}`, value: temporaryPassword })
  })
}

export async function userCommandAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await actionUser('gebruikers:beheren')
  if (!owner) return fail('Alleen de eigenaar kan accounts beheren.')
  const userId = str(fd, 'userId')
  const [command, arg] = str(fd, 'command').split(':')
  const db = getDb()
  return run(async () => {
    switch (command) {
      case 'rol': {
        const role = arg ?? str(fd, 'role')
        if (!isRole(role)) return fail('Kies een geldige rol.')
        await changeRole(db, userId, role, owner.id)
        revalidatePath('/beheer', 'layout')
        return done('Rol gewijzigd. De nieuwe rechten gelden direct.')
      }
      case 'deactiveren':
        await setUserActive(db, userId, false, owner.id)
        revalidatePath('/beheer/gebruikers')
        return done('Account gedeactiveerd en overal uitgelogd.')
      case 'activeren':
        await setUserActive(db, userId, true, owner.id)
        revalidatePath('/beheer/gebruikers')
        return done('Account heeft weer toegang.')
      case 'wachtwoord': {
        const temporaryPassword = await resetUserPassword(db, userId, owner.id)
        revalidatePath('/beheer/gebruikers')
        return done('Nieuw tijdelijk wachtwoord ingesteld; bestaande sessies zijn beëindigd.', { label: 'Tijdelijk wachtwoord', value: temporaryPassword })
      }
      case 'naam': {
        await renameUser(db, userId, str(fd, 'name'), owner.id)
        revalidatePath('/beheer', 'layout')
        return done('Naam opgeslagen.')
      }
      default:
        return fail('Onbekende actie.')
    }
  })
}
