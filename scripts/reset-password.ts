/**
 * Zet een nieuw wachtwoord voor een bestaand account, bijvoorbeeld als de
 * eigenaar zijn of haar wachtwoord kwijt is. Alle sessies van het account
 * vervallen en eventuele inlogblokkades voor het e-mailadres worden opgeheven.
 *
 *   pnpm user:reset-password --email naam@domein.nl
 *
 * Het wachtwoord komt uit NEW_USER_PASSWORD of wordt interactief gevraagd.
 * Zonder terminal wordt een tijdelijk wachtwoord gemaakt dat bij de eerste
 * login gewijzigd moet worden.
 */
import { eq } from 'drizzle-orm'
import { recordAudit } from '../src/server/audit'
import { generateTemporaryPassword, passwordProblem } from '../src/server/auth/password'
import { findUserByEmail, setPassword } from '../src/server/auth/users'
import { closeDb, getDb } from '../src/server/db/client'
import { rateLimits, sessions } from '../src/server/db/schema'
import { hashKey } from '../src/server/rate-limit'
import { arg, readPassword } from './cli'
import { loadEnv } from './env'

async function main() {
  loadEnv()
  const email = arg('email')
  if (!email) throw new Error('Gebruik: pnpm user:reset-password --email naam@domein.nl')
  const db = getDb()
  const user = await findUserByEmail(db, email)
  if (!user) throw new Error(`Geen account gevonden voor ${email}.`)

  const { password, temporary } = await readPassword(generateTemporaryPassword)
  const problem = passwordProblem(password, { email: user.email, name: user.name })
  if (problem) throw new Error(problem)

  await setPassword(db, user.id, password, temporary)
  await db.delete(sessions).where(eq(sessions.userId, user.id))
  await db.delete(rateLimits).where(eq(rateLimits.key, `login-email:${hashKey(user.email)}`))
  await recordAudit(db, {
    actorId: null,
    action: 'gebruiker.wachtwoord_gereset',
    entityType: 'gebruiker',
    entityId: user.id,
    summary: `Wachtwoord opnieuw ingesteld via de opdrachtregel voor ${user.email}`,
  })
  console.log(`Wachtwoord ingesteld voor ${user.email}. Bestaande sessies zijn beëindigd.`)
  if (!user.active) console.log('Let op: dit account is gedeactiveerd en kan pas inloggen nadat een eigenaar het weer toegang geeft.')
  if (temporary) console.log(`Tijdelijk wachtwoord (eenmalig getoond, wijzigen bij eerste login): ${password}`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
