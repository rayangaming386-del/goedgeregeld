import { readFileSync, existsSync } from 'node:fs'

// Integratietests draaien tegen TEST_DATABASE_URL, nooit tegen de ontwikkeldatabase.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]
  }
}
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL ontbreekt; zie .env.example')
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.APP_SECRET ??= 'test-geheim-voor-integratietests-0123456789'
