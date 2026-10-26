import { eq, sql } from 'drizzle-orm'
import type { Role } from '@/domain/permissions'
import { recordAudit } from '../audit'
import { users, type User } from '../db/schema'
import type { DbExecutor } from '../db/types'
import { hashPassword, passwordProblem } from './password'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(db: DbExecutor, email: string): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizeEmail(email)}`)
  return row
}

export async function createUser(
  db: DbExecutor,
  input: { email: string; name: string; role: Role; password: string; mustChangePassword: boolean; actorId: string | null },
): Promise<{ created: boolean; user: User }> {
  const email = normalizeEmail(input.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Ongeldig e-mailadres.')
  const problem = passwordProblem(input.password, { email })
  if (problem) throw new Error(problem)
  const existing = await findUserByEmail(db, email)
  if (existing) return { created: false, user: existing }
  const passwordHash = await hashPassword(input.password)
  const [user] = await db
    .insert(users)
    .values({ email, name: input.name.trim() || email, role: input.role, passwordHash, mustChangePassword: input.mustChangePassword })
    .returning()
  await recordAudit(db, {
    actorId: input.actorId,
    action: 'gebruiker.aangemaakt',
    entityType: 'gebruiker',
    entityId: user!.id,
    summary: `Account aangemaakt voor ${email} (${input.role})`,
  })
  return { created: true, user: user! }
}

export async function setPassword(db: DbExecutor, userId: string, password: string, mustChange: boolean) {
  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash, mustChangePassword: mustChange, updatedAt: new Date() }).where(eq(users.id, userId))
}
