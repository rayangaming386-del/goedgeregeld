import { hash, verify } from '@node-rs/argon2'

// Argon2id met de door OWASP aanbevolen minimuminstellingen (19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 200

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

const WEAK = new Set(['wachtwoord123', 'welkom123456', 'password1234', 'qwertyuiop12', 'goedgeregeld1', '123456789012'])

/** Eenvoudige sterktecontrole; geeft een melding of null. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Gebruik minimaal ${PASSWORD_MIN} tekens.`
  if (password.length > PASSWORD_MAX) return `Gebruik maximaal ${PASSWORD_MAX} tekens.`
  if (/^(.)\1+$/.test(password)) return 'Gebruik niet steeds hetzelfde teken.'
  const lower = password.toLowerCase()
  if (WEAK.has(lower)) return 'Dit wachtwoord is te voorspelbaar.'
  const local = context.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return 'Gebruik je e-mailadres niet in je wachtwoord.'
  return null
}

/** Een tijdelijk wachtwoord voor nieuwe accounts (wordt eenmalig getoond). */
export function generateTemporaryPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `${out.slice(0, 6)}-${out.slice(6, 12)}-${out.slice(12, 18)}`
}
