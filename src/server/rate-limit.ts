import { createHmac } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { DbExecutor } from './db/types'

function secret(): string {
  const s = process.env.APP_SECRET
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET ontbreekt of is te kort (min. 32 tekens).')
    return 'ontwikkel-geheim-niet-voor-productie-gebruiken-0000'
  }
  return s
}

/** Niet-omkeerbare sleutel voor IP-adressen en e-mailadressen (geen ruwe gegevens opslaan). */
export function hashKey(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url').slice(0, 32)
}

export function signValue(value: string): string {
  return createHmac('sha256', secret()).update(`sig:${value}`).digest('base64url')
}

/**
 * Vaste-venster limiet in de database (werkt ook met meerdere serverinstanties).
 * Geeft terug of de actie is toegestaan en hoeveel pogingen er nog over zijn.
 */
export async function hitRateLimit(
  db: DbExecutor,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const result = await db.execute<{ count: number; reset_at: Date }>(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `)
  const row = result.rows[0]!
  const count = Number(row.count)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: new Date(row.reset_at) }
}

export async function clearRateLimit(db: DbExecutor, key: string): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`)
}

/** Opruimen van verlopen tellers (wordt periodiek vanuit het beheer aangeroepen). */
export async function pruneRateLimits(db: DbExecutor): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`)
}
