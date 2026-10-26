import { auditLog, revisions } from './db/schema'
import type { DbExecutor } from './db/types'

export type Changes = Record<string, { van: unknown; naar: unknown }>

/** Vergelijkt twee objecten op de opgegeven velden. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: (keyof T)[]): Changes {
  const changes: Changes = {}
  for (const f of fields) {
    if (!(f in after)) continue
    const a = before[f]
    const b = after[f]
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      changes[String(f)] = { van: a ?? null, naar: b ?? null }
    }
  }
  return changes
}

export async function recordAudit(
  db: DbExecutor,
  entry: {
    actorId: string | null
    action: string
    entityType: string
    entityId?: string | null
    summary: string
    changes?: Changes | null
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    changes: entry.changes && Object.keys(entry.changes).length ? entry.changes : null,
  })
}

/** Bewaart de vorige versie zodat een wijziging hersteld kan worden. */
export async function recordRevision(
  db: DbExecutor,
  entry: { entityType: string; entityId: string; snapshot: unknown; actorId: string | null; summary?: string },
): Promise<void> {
  await db.insert(revisions).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    snapshot: entry.snapshot as object,
    actorId: entry.actorId,
    summary: entry.summary ?? '',
  })
}
