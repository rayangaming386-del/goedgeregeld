import { existsSync, readFileSync } from 'node:fs'

/** Laadt .env zonder bestaande omgevingsvariabelen te overschrijven. */
export function loadEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]
  }
}

export const ACCOUNTS_FILE = 'tests/e2e/.artifacts/accounts.json'
export const E2E_DOMAIN = 'e2e.goedgeregeld.test'

export type Accounts = Record<'eigenaar' | 'medewerker' | 'redacteur', { email: string; password: string }>
