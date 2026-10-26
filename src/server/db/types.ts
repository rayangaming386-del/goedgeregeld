import type { Database } from './client'

/** Database of transactie: beide bieden dezelfde querybouwers. */
export type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query'>
