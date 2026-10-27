import { rmSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { clearTestRateLimits } from './cleanup'
import { ACCOUNTS_FILE, E2E_DOMAIN, loadEnv } from './env'

/** Verwijdert de tijdelijke accounts en alles wat de tests hebben aangemaakt. */
export default async function globalTeardown() {
  loadEnv()
  const { getDb, closeDb } = await import('../../src/server/db/client')
  const db = getDb()
  await db.execute(sql`DELETE FROM reservations WHERE customer_name LIKE 'E2E %'`)
  await db.execute(sql`DELETE FROM availability_blocks WHERE reason LIKE 'E2E %'`)
  // Testauto’s met hun foto’s (bestanden én databaseregels).
  const { removeFiles } = await import('../../src/server/media/service')
  const { media, vehicles } = await import('../../src/server/db/schema')
  const { inArray, like } = await import('drizzle-orm')
  const testVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(like(vehicles.name, 'E2E %'))
  if (testVehicles.length) {
    const ids = testVehicles.map((v) => v.id)
    const files = await db.select({ originalKey: media.originalKey, variants: media.variants }).from(media).where(inArray(media.vehicleId, ids))
    for (const f of files) await removeFiles(f)
    await db.execute(sql`DELETE FROM reservations WHERE vehicle_id IN (SELECT id FROM vehicles WHERE name LIKE 'E2E %')`)
    await db.delete(vehicles).where(inArray(vehicles.id, ids))
  }
  await clearTestRateLimits(db, ['eigenaar', 'medewerker', 'redacteur'].map((r) => `${r}@${E2E_DOMAIN}`))
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%@${E2E_DOMAIN}`}`)
  await closeDb()
  rmSync(ACCOUNTS_FILE, { force: true })
}
