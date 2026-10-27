import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { clearTestRateLimits } from './cleanup'
import { ACCOUNTS_FILE, E2E_DOMAIN, loadEnv, type Accounts } from './env'

/**
 * Maakt per run drie tijdelijke accounts (één per rol) met willekeurige
 * wachtwoorden. Er worden geen vaste wachtwoorden in de code opgeslagen.
 */
export default async function globalSetup() {
  loadEnv()
  const { getDb, closeDb } = await import('../../src/server/db/client')
  const { hashPassword } = await import('../../src/server/auth/password')
  const { users } = await import('../../src/server/db/schema')
  const db = getDb()
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%@${E2E_DOMAIN}`}`)
  const accounts = {} as Accounts
  for (const role of ['eigenaar', 'medewerker', 'redacteur'] as const) {
    const password = `E2e-${randomBytes(12).toString('base64url')}`
    const email = `${role}@${E2E_DOMAIN}`
    await db.insert(users).values({ email, name: `E2E ${role}`, role, passwordHash: await hashPassword(password) })
    accounts[role] = { email, password }
  }
  await clearTestRateLimits(db, Object.values(accounts).map((a) => a.email))
  mkdirSync('tests/e2e/.artifacts', { recursive: true })
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts), { mode: 0o600 })
  await closeDb()
}
