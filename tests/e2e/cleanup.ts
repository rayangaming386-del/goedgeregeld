import { inArray } from 'drizzle-orm'
import type { Database } from '../../src/server/db/client'

/** Adressen waaronder lokale testverzoeken binnenkomen. */
const LOCAL_IPS = ['onbekend', '127.0.0.1', '::1', '::ffff:127.0.0.1']

/**
 * Wist alleen de rate-limittellers van lokale testverzoeken en de
 * testaccounts, zodat herhaalde testruns elkaar niet blokkeren.
 */
export async function clearTestRateLimits(db: Database, emails: string[]) {
  const { hashKey } = await import('../../src/server/rate-limit')
  const { rateLimits } = await import('../../src/server/db/schema')
  const keys: string[] = []
  for (const ip of LOCAL_IPS) {
    const ipKey = hashKey(`ip:${ip}`)
    keys.push(`aanvraag:10m:${ipKey}`, `aanvraag:24h:${ipKey}`, `login-ip:${ipKey}`)
    for (const email of emails) keys.push(`login:${hashKey(`${email}|${ip}`)}`)
  }
  for (const email of emails) keys.push(`login-email:${hashKey(email)}`)
  await db.delete(rateLimits).where(inArray(rateLimits.key, keys))
}
