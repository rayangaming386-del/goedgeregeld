import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { ACCOUNTS_FILE, type Accounts } from './env'

// Playwright laadt de tests als CommonJS; require is beschikbaar.
const axePath = require.resolve('axe-core/axe.min.js')

export function accounts(): Accounts {
  return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Accounts
}

export async function login(page: Page, role: keyof Accounts) {
  const { email, password } = accounts()[role]
  await page.goto('/beheer/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await Promise.all([page.waitForURL(/\/beheer(?!\/login)/), page.locator('form[aria-label] button[type=submit], main form button[type=submit]').first().click()])
}

/** Verzamelt JavaScript-fouten en consolefouten tijdens een test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

export type AxeViolation = { id: string; impact: string | null; help: string; nodes: Array<{ target: string[]; failureSummary?: string }> }

/** Voert axe-core uit op de huidige pagina (WCAG 2.0/2.1/2.2 A en AA). */
export async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axePath })
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: AxeViolation[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    })
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target as string[], failureSummary: n.failureSummary })),
    }))
  })
}

/** Horizontale overloop van de pagina in pixels. */
export function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

/** Afbeeldingen die niet zijn geladen (na scrollen door de pagina). */
export async function brokenImages(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
  return page.evaluate(() =>
    [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
      .map((img) => img.currentSrc || img.src),
  )
}
