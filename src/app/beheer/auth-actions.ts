'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { recordAudit } from '@/server/audit'
import { getDummyHash, passwordProblem, verifyPassword } from '@/server/auth/password'
import { createSession, destroyAllSessions, destroySession, getCurrentUser } from '@/server/auth/session'
import { findUserByEmail, normalizeEmail, setPassword } from '@/server/auth/users'
import { getDb } from '@/server/db/client'
import { users } from '@/server/db/schema'
import { clientIp } from '@/server/client-ip'
import { clearRateLimit, hashKey, hitRateLimit } from '@/server/rate-limit'
import type { ActionState } from '@/components/admin/action-state'

const GENERIC = 'E-mailadres of wachtwoord onjuist.'

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get('email') ?? '')).slice(0, 200)
  const password = String(formData.get('password') ?? '').slice(0, 300)
  if (!email || !password) return { ok: false, message: 'Vul je e-mailadres en wachtwoord in.' }

  const db = getDb()
  const h = await headers()
  const ip = clientIp(h)
  const ipKey = hashKey(`ip:${ip}`)
  const accountKey = `login:${hashKey(`${email}|${ip}`)}`
  const perAccount = await hitRateLimit(db, accountKey, 6, 15 * 60)
  const perIp = await hitRateLimit(db, `login-ip:${ipKey}`, 40, 15 * 60)
  // Los van het IP-adres: beschermt een account ook als het adres wisselt.
  const perEmail = await hitRateLimit(db, `login-email:${hashKey(email)}`, 30, 15 * 60)
  if (!perAccount.allowed || !perIp.allowed || !perEmail.allowed) {
    return { ok: false, message: 'Te veel inlogpogingen. Wacht een kwartier en probeer het opnieuw.' }
  }

  const user = await findUserByEmail(db, email)
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password)
  if (!user || !valid || !user.active) return { ok: false, message: GENERIC }

  await clearRateLimit(db, accountKey)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await createSession(user.id)
  await recordAudit(db, { actorId: user.id, action: 'gebruiker.ingelogd', entityType: 'gebruiker', entityId: user.id, summary: 'Ingelogd' })
  redirect(user.mustChangePassword ? '/beheer/account?wijzigen=1' : '/beheer')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/beheer/login')
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Vul je huidige wachtwoord in.'),
    next: z.string(),
    repeat: z.string(),
  })
  .refine((v) => v.next === v.repeat, { path: ['repeat'], message: 'De wachtwoorden komen niet overeen.' })

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) redirect('/beheer/login')
  const parsed = passwordSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    repeat: formData.get('repeat'),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Controleer de velden.', errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) }
  }
  const problem = passwordProblem(parsed.data.next, { email: user.email, name: user.name })
  if (problem) return { ok: false, message: 'Kies een sterker wachtwoord.', errors: { next: problem } }
  const db = getDb()
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id))
  if (!row || !(await verifyPassword(row.hash, parsed.data.current))) {
    return { ok: false, message: 'Controleer de velden.', errors: { current: 'Je huidige wachtwoord klopt niet.' } }
  }
  await setPassword(db, user.id, parsed.data.next, false)
  // Andere sessies afmelden, daarna opnieuw inloggen in deze browser.
  await destroyAllSessions(user.id)
  await createSession(user.id)
  await recordAudit(db, { actorId: user.id, action: 'gebruiker.wachtwoord', entityType: 'gebruiker', entityId: user.id, summary: 'Eigen wachtwoord gewijzigd' })
  // Na een verplichte wijziging verdwijnt het formulier; toon de bevestiging op de accountpagina.
  if (user.mustChangePassword) redirect('/beheer/account?gewijzigd=1')
  return { ok: true, message: 'Je wachtwoord is gewijzigd. Andere sessies zijn afgemeld.' }
}
