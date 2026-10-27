import { expect, test } from '@playwright/test'
import { login, runAxe, type AxeViolation } from './helpers'

/**
 * Toegankelijkheid (axe-core, WCAG 2.2 A/AA). Bewegingen staan uit, zodat
 * elementen niet halverwege een animatie worden beoordeeld.
 */
const PUBLIC = ['/', '/wagenpark', '/wagenpark/audi-rs3-sportback', '/wagenpark/audi-sq8', '/aanvragen', '/bestaat-niet']

const ADMIN = [
  '/beheer',
  '/beheer/aanvragen',
  '/beheer/aanvragen/nieuw',
  '/beheer/kalender',
  '/beheer/kalender?weergave=week',
  '/beheer/wagenpark',
  '/beheer/wagenpark/nieuw',
  '/beheer/acties',
  '/beheer/inhoud',
  '/beheer/inhoud?tab=faq',
  '/beheer/inhoud?tab=paginas',
  '/beheer/inhoud?tab=versies',
  '/beheer/publicatie',
  '/beheer/gebruikers',
  '/beheer/geschiedenis',
  '/beheer/account',
]

function describe(path: string, violations: AxeViolation[]) {
  return violations.map((v) => `${path} · ${v.impact} · ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
}

test.use({ colorScheme: 'dark' })

test('publieke pagina’s hebben geen toegankelijkheidsfouten', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const found: string[] = []
  for (const path of PUBLIC) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    found.push(...describe(path, await runAxe(page)))
  }
  expect(found, found.join('\n')).toEqual([])
})

test('inlogpagina en beheer hebben geen toegankelijkheidsfouten', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const found: string[] = []
  await page.goto('/beheer/login')
  found.push(...describe('/beheer/login', await runAxe(page)))
  await login(page, 'eigenaar')
  const paths = [...ADMIN]
  // Detailpagina’s van de eerste aanvraag en de eerste auto, met alle tabbladen.
  await page.goto('/beheer/aanvragen?status=alle')
  const firstRequest = await page.locator('table a[href^="/beheer/aanvragen/"]').first().getAttribute('href')
  if (firstRequest) paths.push(firstRequest)
  await page.goto('/beheer/wagenpark')
  const firstVehicle = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/beheer/wagenpark/"]')]
      .map((a) => a.getAttribute('href') ?? '')
      .find((h) => /^\/beheer\/wagenpark\/[0-9a-f-]{36}$/.test(h)),
  )
  if (firstVehicle) {
    const base = firstVehicle
    for (const tab of ['algemeen', 'specificaties', 'prijzen', 'fotos', 'seo', 'brongegevens', 'historie']) paths.push(`${base}?tab=${tab}`)
    paths.push(`${base}/voorbeeld`)
  }
  for (const path of paths) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    found.push(...describe(path, await runAxe(page)))
  }
  expect(found, found.join('\n')).toEqual([])
})
