import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { can, type Permission, type Role } from '@/domain/permissions'
import { getDb } from '../db/client'
import { sessions, users } from '../db/schema'

const SESSION_DAYS = 7
const RENEW_WHEN_DAYS_LEFT = 6
const DAY_MS = 86_400_000

function secureCookies(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === 'false') return false
  if (process.env.SESSION_COOKIE_SECURE === 'true') return true
  return process.env.NODE_ENV === 'production'
}

/** `__Host-` dwingt Secure, Path=/ en geen Domain af (alleen over HTTPS). */
export function sessionCookieName(): string {
  return secureCookies() ? '__Host-gg_sessie' : 'gg_sessie'
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  mustChangePassword: boolean
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS)
  const db = getDb()
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt })
  // Verlopen sessies van deze gebruiker opruimen.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())))
  const jar = await cookies()
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/** Huidige gebruiker op basis van de sessiecookie (per request gecachet). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const token = jar.get(sessionCookieName())?.value
  if (!token || token.length > 100) return null
  const db = getDb()
  const id = hashToken(token)
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
  if (!row || !row.active) return null
  // Glijdende verlenging in de database (cookie verloopt na de maximale duur).
  if (row.expiresAt.getTime() - Date.now() < RENEW_WHEN_DAYS_LEFT * DAY_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS) })
      .where(eq(sessions.id, id))
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: row.mustChangePassword }
})

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(sessionCookieName())?.value
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)))
  jar.delete(sessionCookieName())
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}

/** Voor pagina’s: stuurt door naar de login als er geen sessie is. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/beheer/login')
  return user
}

export class ForbiddenError extends Error {
  constructor(message = 'Je hebt geen rechten voor deze actie.') {
    super(message)
  }
}

/** Voor pagina’s en acties: gebruiker met het gevraagde recht, anders een fout. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.role, permission)) throw new ForbiddenError()
  return user
}

/** Voor Server Actions: geeft null terug in plaats van door te sturen. */
export async function actionUser(permission?: Permission): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (permission && !can(user.role, permission)) return null
  return user
}
