import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { closeDb, getDb } from '../src/server/db/client'
import { loadEnv } from './env'

async function main() {
  loadEnv()
  const db = getDb()
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migraties uitgevoerd.')
}

main()
  .catch((err) => {
    console.error('Migratie mislukt:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
