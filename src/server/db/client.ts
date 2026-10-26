import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

type Cached = { pool: Pool; db: Database }

const globalForDb = globalThis as unknown as { __ggDb?: Cached }

function create(): Cached {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL ontbreekt. Zie .env.example.')
  }
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
  })
  // Een verbroken idle-verbinding mag het proces niet laten crashen.
  pool.on('error', (err) => {
    console.error('[db] fout op idle-verbinding:', err.message)
  })
  return { pool, db: drizzle(pool, { schema }) }
}

/** Gedeelde verbinding; in ontwikkeling hergebruikt tussen hot reloads. */
export function getDb(): Database {
  if (!globalForDb.__ggDb) globalForDb.__ggDb = create()
  return globalForDb.__ggDb.db
}

export function getPool(): Pool {
  if (!globalForDb.__ggDb) globalForDb.__ggDb = create()
  return globalForDb.__ggDb.pool
}

export async function closeDb(): Promise<void> {
  if (globalForDb.__ggDb) {
    await globalForDb.__ggDb.pool.end()
    globalForDb.__ggDb = undefined
  }
}

export { schema }
