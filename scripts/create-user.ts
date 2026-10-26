/**
 * Maakt een beheeraccount aan.
 *
 *   pnpm user:create --email naam@domein.nl --name "Naam" --role eigenaar
 *
 * Het wachtwoord komt uit NEW_USER_PASSWORD of wordt interactief gevraagd.
 * Zonder terminal wordt een tijdelijk wachtwoord gegenereerd dat bij de eerste
 * login gewijzigd moet worden.
 */
import { createInterface } from 'node:readline'
import { isRole } from '../src/domain/permissions'
import { generateTemporaryPassword } from '../src/server/auth/password'
import { createUser } from '../src/server/auth/users'
import { closeDb, getDb } from '../src/server/db/client'
import { loadEnv } from './env'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  let muted = false
  out._writeToOutput = (s: string) => {
    if (!muted || s.includes('\n')) out.output.write(muted ? '\n' : s)
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
    muted = true
  })
}

async function main() {
  loadEnv()
  const email = arg('email')
  const name = arg('name') ?? ''
  const role = arg('role') ?? 'eigenaar'
  if (!email) throw new Error('Gebruik: pnpm user:create --email … --name … --role eigenaar|medewerker|redacteur')
  if (!isRole(role)) throw new Error('Rol moet eigenaar, medewerker of redacteur zijn.')

  let password = process.env.NEW_USER_PASSWORD ?? ''
  let mustChange = false
  if (!password && process.stdin.isTTY) {
    password = await askHidden('Wachtwoord (min. 12 tekens): ')
    const repeat = await askHidden('Herhaal wachtwoord: ')
    if (password !== repeat) throw new Error('De wachtwoorden komen niet overeen.')
  }
  if (!password) {
    password = generateTemporaryPassword()
    mustChange = true
  }

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
