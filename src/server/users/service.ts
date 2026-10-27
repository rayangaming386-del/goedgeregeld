/**
 * Gebruikersbeheer door de eigenaar.
 *
 * Er moet altijd minstens één actieve eigenaar zijn. Twee eigenaren die
 * tegelijk elkaars rol wijzigen of elkaar deactiveren, worden achter elkaar
 * gezet met een transactie-advisory-lock; de tweede ziet dan de nieuwe stand.
 */
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { ROLE_LABELS, type Role } from '@/domain/permissions'
import { recordAudit } from '../audit'
import { hashPassword, generateTemporaryPassword } from '../auth/password'
import { createUser } from '../auth/users'
import type { Database } from '../db/client'
import { sessions, users, type User } from '../db/schema'
import type { DbExecutor } from '../db/types'

export class UserAdminError extends Error {}

const UNIQUE_VIOLATION = '23505'

async function lockOwners(tx: DbExecutor) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('gebruikers:eigenaren', 0))`)
}

async function activeOwnerCount(tx: DbExecutor): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, 'eigenaar'), eq(users.active, true)))
  return row?.n ?? 0
}

async function lockedUser(tx: DbExecutor, userId: string): Promise<User> {
  const [row] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
  if (!row) throw new UserAdminError('Gebruiker niet gevonden.')
  return row
}

export type UserListItem = Pick<User, 'id' | 'email' | 'name' | 'role' | 'active' | 'mustChangePassword' | 'lastLoginAt' | 'createdAt'>

export async function listUsers(db: DbExecutor): Promise<UserListItem[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.active), asc(users.name))
}

/** Nieuw account met een tijdelijk wachtwoord dat bij de eerste login moet worden gewijzigd. */
export async function inviteUser(
  db: Database,
  input: { email: string; name: string; role: Role },
  actorId: string,
): Promise<{ user: User; temporaryPassword: string }> {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) throw new UserAdminError('Gebruik een naam van 2 tot 80 tekens.')
  const temporaryPassword = generateTemporaryPassword()
  try {
    const { created, user } = await createUser(db, {
      email: input.email,
      name,
      role: input.role,
      password: temporaryPassword,
      mustChangePassword: true,
      actorId,
    })
    if (!created) throw new UserAdminError('Er bestaat al een account met dit e-mailadres.')
    return { user, temporaryPassword }
  } catch (err) {
    if (err instanceof UserAdminError) throw err
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new UserAdminError('Er bestaat al een account met dit e-mailadres.')
    if (err instanceof Error && err.message === 'Ongeldig e-mailadres.') throw new UserAdminError('Vul een geldig e-mailadres in.')
    throw err
  }
}

export async function changeRole(db: Database, userId: string, role: Role, actorId: string): Promise<void> {
  if (userId === actorId) throw new UserAdminError('Je kunt je eigen rol niet wijzigen. Laat dit door een andere eigenaar doen.')
  await db.transaction(async (tx) => {
    await lockOwners(tx)
    const target = await lockedUser(tx, userId)
    if (target.role === role) return
    if (target.role === 'eigenaar' && target.active && (await activeOwnerCount(tx)) <= 1) {
      throw new UserAdminError('Er moet minstens één actieve eigenaar overblijven.')
    }
    await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId))
    await recordAudit(tx, {
      actorId,
      action: 'gebruiker.rol_gewijzigd',
      entityType: 'gebruiker',
      entityId: userId,
      summary: `Rol van ${target.email} gewijzigd naar ${ROLE_LABELS[role]}`,
      changes: { rol: { van: target.role, naar: role } },
    })
  })
}

export async function setUserActive(db: Database, userId: string, active: boolean, actorId: string): Promise<void> {
  if (userId === actorId && !active) throw new UserAdminError('Je kunt je eigen account niet deactiveren.')
  await db.transaction(async (tx) => {
    await lockOwners(tx)
    const target = await lockedUser(tx, userId)
    if (target.active === active) return
    if (!active && target.role === 'eigenaar' && (await activeOwnerCount(tx)) <= 1) {
      throw new UserAdminError('Er moet minstens één actieve eigenaar overblijven.')
    }
    await tx.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId))
    // Een gedeactiveerd account wordt overal direct uitgelogd.
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, userId))
    await recordAudit(tx, {
      actorId,
      action: active ? 'gebruiker.geactiveerd' : 'gebruiker.gedeactiveerd',
      entityType: 'gebruiker',
      entityId: userId,
      summary: `${target.email} ${active ? 'weer toegang gegeven' : 'gedeactiveerd'}`,
    })
  })
}

/** Nieuw tijdelijk wachtwoord; bestaande sessies van die gebruiker vervallen. */
export async function resetUserPassword(db: Database, userId: string, actorId: string): Promise<string> {
  if (userId === actorId) throw new UserAdminError('Wijzig je eigen wachtwoord via Mijn account.')
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await db.transaction(async (tx) => {
    const target = await lockedUser(tx, userId)
    await tx.update(users).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, userId))
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await recordAudit(tx, {
      actorId,
      action: 'gebruiker.wachtwoord_gereset',
      entityType: 'gebruiker',
      entityId: userId,
      summary: `Tijdelijk wachtwoord ingesteld voor ${target.email}`,
    })
  })
  return temporaryPassword
}

export async function renameUser(db: Database, userId: string, name: string, actorId: string): Promise<void> {
  const clean = name.trim()
  if (clean.length < 2 || clean.length > 80) throw new UserAdminError('Gebruik een naam van 2 tot 80 tekens.')
  await db.transaction(async (tx) => {
    const target = await lockedUser(tx, userId)
    if (target.name === clean) return
    await tx.update(users).set({ name: clean, updatedAt: new Date() }).where(eq(users.id, userId))
    await recordAudit(tx, {
      actorId,
      action: 'gebruiker.bijgewerkt',
      entityType: 'gebruiker',
      entityId: userId,
      summary: `Naam van ${target.email} gewijzigd`,
      changes: { naam: { van: target.name, naar: clean } },
    })
  })
}

