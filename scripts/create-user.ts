/**
 * Maakt een beheeraccount aan.
 *
 *   pnpm user:create --email naam@domein.nl --name "Naam" --role eigenaar
 *
 * Het wachtwoord komt uit NEW_USER_PASSWORD of wordt interactief gevraagd.
 * Zonder terminal wordt een tijdelijk wachtwoord gegenereerd dat bij de eerste
 * login gewijzigd moet worden.
 */
import { isRole } from '../src/domain/permissions'
import { generateTemporaryPassword } from '../src/server/auth/password'
import { createUser } from '../src/server/auth/users'
import { closeDb, getDb } from '../src/server/db/client'
import { arg, readPassword } from './cli'
import { loadEnv } from './env'

async function main() {
  loadEnv()
  const email = arg('email')
  const name = arg('name') ?? ''
  const role = arg('role') ?? 'eigenaar'
  if (!email) throw new Error('Gebruik: pnpm user:create --email … --name … --role eigenaar|medewerker|redacteur')
  if (!isRole(role)) throw new Error('Rol moet eigenaar, medewerker of redacteur zijn.')

  const { password, temporary: mustChange } = await readPassword(generateTemporaryPassword)

  const result = await createUser(getDb(), { email, name, role, password, mustChangePassword: mustChange, actorId: null })
  if (!result.created) {
    console.log(`Er bestaat al een account voor ${email}.`)
    return
  }
  console.log(`Account aangemaakt: ${email} (${role}).`)
  if (mustChange) {
    console.log(`Tijdelijk wachtwoord (eenmalig getoond, wijzigen bij eerste login): ${password}`)
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
