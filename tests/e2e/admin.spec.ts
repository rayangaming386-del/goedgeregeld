import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { login, watchErrors } from './helpers'

// Beheertests muteren data; alleen op desktop, één keer per run.
test.skip(({ isMobile }) => isMobile, 'beheertests draaien op desktop')

const PHOTOS = [
  path.resolve('bronmateriaal/fotos/sq5/sq5-01.jpeg'),
  path.resolve('bronmateriaal/fotos/sq5/sq5-02.jpeg'),
]

/** Datum in de toekomst (lokale tijd Amsterdam), ver weg van echte planning. */
function day(offset: number) {
  return new Date(Date.now() + offset * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

async function expectMessage(page: Page, form: string, text: RegExp | string) {
  await expect(page.locator(`form[aria-label="${form}"] .adm-message`).first()).toContainText(text, { timeout: 20_000 })
}

test.describe('inloggen en rechten', () => {
  test('verkeerd wachtwoord geeft een algemene melding', async ({ page }) => {
    await page.goto('/beheer/login')
    await page.fill('#email', 'eigenaar@e2e.goedgeregeld.test')
    await page.fill('#password', 'een-verkeerd-wachtwoord')
    await page.locator('main form button[type=submit]').click()
    await expect(page.locator('.adm-message.is-error')).toHaveText('E-mailadres of wachtwoord onjuist.')
    await expect(page).toHaveURL(/\/beheer\/login/)
  })

  test('beheer zonder sessie stuurt door naar de login', async ({ page }) => {
    await page.goto('/beheer/aanvragen')
    await expect(page).toHaveURL(/\/beheer\/login/)
  })

  test('redacteur ziet geen aanvragen, gebruikers of prijzen', async ({ page }) => {
    await login(page, 'redacteur')
    const nav = (await page.locator('nav a').allTextContents()).map((t) => t.trim())
    expect(nav).toEqual(expect.arrayContaining(['Wagenpark', 'Website-inhoud']))
    expect(nav).not.toContain('Aanvragen')
    expect(nav).not.toContain('Gebruikers')
    for (const url of ['/beheer/aanvragen', '/beheer/kalender', '/beheer/gebruikers', '/beheer/acties', '/beheer/geschiedenis']) {
      await page.goto(url)
      await expect(page.locator('h1')).toHaveText('Geen toegang')
    }
    await page.goto('/beheer/wagenpark')
    await page.locator('a[href^="/beheer/wagenpark/"]').filter({ hasText: 'Audi SQ5' }).first().click()
    await page.getByRole('link', { name: 'Prijzen' }).click()
    await expect(page.getByRole('button', { name: 'Prijzen opslaan' })).toHaveCount(0)
  })

  test('medewerker kan geen website-inhoud of gebruikers beheren', async ({ page }) => {
    await login(page, 'medewerker')
    for (const url of ['/beheer/inhoud', '/beheer/gebruikers', '/beheer/acties']) {
      await page.goto(url)
      await expect(page.locator('h1')).toHaveText('Geen toegang')
    }
  })
})

test.describe('aanvragen en planning', () => {
  test('bevestigen, overlap weigeren en blokkade controleren', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page, 'medewerker')

    const create = async (name: string, startOffset: number, endOffset: number) => {
      await page.goto('/beheer/aanvragen/nieuw')
      await page.selectOption('#vehicleId', { label: 'Audi SQ5' })
      await page.fill('#startDate', day(startOffset))
      await page.fill('#startTime', '10:00')
      await page.fill('#endDate', day(endOffset))
      await page.fill('#endTime', '10:00')
      await page.fill('#name', name)
      await page.fill('#phone', '0612345678')
      await Promise.all([page.waitForURL(/\/beheer\/aanvragen\/[0-9a-f-]{36}$/), page.locator('form[aria-label="Aanvraag toevoegen"] button[type=submit]').click()])
      return page.url()
    }

    // Eerste aanvraag bevestigen.
    const first = await create('E2E Eerste klant', 300, 303)
    await page.locator('form[aria-label="Status wijzigen"]').getByRole('button', { name: 'Bevestigen' }).click()
    await expectMessage(page, 'Status wijzigen', /bevestigd/i)

    // Tweede aanvraag in dezelfde periode kan niet ook bevestigd worden.
    await create('E2E Tweede klant', 301, 302)
    await page.locator('form[aria-label="Status wijzigen"]').getByRole('button', { name: 'Bevestigen' }).click()
    await expectMessage(page, 'Status wijzigen', /overlap/i)
    await page.reload()
    // Nog steeds te bevestigen: de status is niet gewijzigd.
    await expect(page.locator('form[aria-label="Status wijzigen"]').getByRole('button', { name: 'Bevestigen' })).toBeVisible()

    // Een blokkade over de bevestigde periode wordt geweigerd.
    await page.goto('/beheer/kalender')
    const block = page.locator('form[aria-label="Blokkade toevoegen"]')
    await block.locator('#b-auto').selectOption({ label: 'Audi SQ5' })
    await block.locator('#b-reason').fill('E2E onderhoud')
    await block.locator('#b-sd').fill(day(301))
    await block.locator('#b-ed').fill(day(301))
    await block.getByRole('button', { name: 'Blokkade opslaan' }).click()
    await expectMessage(page, 'Blokkade toevoegen', 'Blokkade niet opgeslagen')

    // Buiten de reservering lukt het wel.
    await block.locator('#b-sd').fill(day(310))
    await block.locator('#b-ed').fill(day(310))
    await block.locator('#b-reason').fill('E2E onderhoud later')
    await block.getByRole('button', { name: 'Blokkade opslaan' }).click()
    await expectMessage(page, 'Blokkade toevoegen', 'Blokkade toegevoegd')

    await page.goto(first)
    await expect(page.locator('main')).toContainText('Bevestigd')
    expect(errors).toEqual([])
  })
})

test.describe('wagenpark', () => {
  test('testauto aanmaken, foto’s uploaden en sorteren, prijs wijzigen, publiceren en weer verwijderen', async ({ page }) => {
    const errors = watchErrors(page)
    await login(page, 'eigenaar')

    await page.goto('/beheer/wagenpark/nieuw')
    await page.fill('#model', 'E2E Model')
    await page.fill('#name', 'E2E Testauto')
    await Promise.all([page.waitForURL(/\/beheer\/wagenpark\/[0-9a-f-]{36}\?aangemaakt=1/), page.getByRole('button', { name: 'Concept aanmaken' }).click()])
    const base = page.url().split('?')[0]!

    // Publiceren zonder foto en omschrijving wordt geweigerd.
    await page.locator('form[aria-label="Status"]').getByRole('button', { name: 'Publiceren' }).click()
    await expectMessage(page, 'Status', /minstens één publieke foto/)

    // Omschrijving invullen.
    await page.fill('#tagline', 'Testauto voor de automatische tests.')
    await page.locator('form[aria-label="Algemene gegevens"]').getByRole('button', { name: 'Opslaan' }).click()
    await expectMessage(page, 'Algemene gegevens', /opgeslagen/i)

    // Twee foto’s uploaden.
    await page.goto(`${base}?tab=fotos`)
    await page.setInputFiles('#upload', PHOTOS)
    await expect(page.locator('.adm-upload-list .tone-ok')).toHaveCount(2, { timeout: 60_000 })
    await page.reload()
    await expect(page.locator('.adm-photos > li')).toHaveCount(2)
    const firstSrc = await page.locator('.adm-photos > li').first().locator('img').first().getAttribute('src')
    await page.locator('form[aria-label="Acties foto 1"]').getByRole('button', { name: /naar achteren/ }).click()
    await expect.poll(async () => page.locator('.adm-photos > li').first().locator('img').first().getAttribute('src'), { timeout: 15_000 }).not.toBe(firstSrc)

    // Alt-tekst voor de eerste foto.
    const altForm = page.locator('form[aria-label="Foto 1 bewerken"]')
    await altForm.locator('textarea, input[name="alt"]').first().fill('Testfoto van de testauto in de showroom.')
    await altForm.getByRole('button', { name: 'Opslaan' }).click()
    await expectMessage(page, 'Foto 1 bewerken', /opgeslagen/i)

    // Prijs wijzigen (alleen eigenaar).
    await page.goto(`${base}?tab=prijzen`)
    await page.fill('#dayRate', '123')
    await page.getByRole('button', { name: 'Prijzen opslaan' }).click()
    await expectMessage(page, 'Prijzen', /opgeslagen/i)

    // Publiceren en controleren op de website.
    await page.locator('form[aria-label="Status"]').getByRole('button', { name: 'Publiceren' }).click()
    await expectMessage(page, 'Status', /staat op de website/)
    await page.goto('/wagenpark')
    const card = page.locator('a[href^="/wagenpark/"]').filter({ hasText: 'E2E Testauto' }).first()
    await expect(card).toBeAttached()
    const publicPath = await card.getAttribute('href')
    const res = await page.goto(publicPath!)
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toContainText('E2E Testauto')

    // Offline halen: niet meer bereikbaar.
    await page.goto(base)
    await page.locator('form[aria-label="Status"]').getByRole('button', { name: 'Offline halen (concept)' }).click()
    await expectMessage(page, 'Status', /offline gehaald/)
    const gone = await page.goto(publicPath!)
    expect(gone?.status()).toBe(404)

    // Verwijderen (inclusief foto’s).
    await page.goto(base)
    await page.locator('form[aria-label="Verwijderen"]').getByRole('button', { name: 'Verwijderen' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Definitief verwijderen' }).click()
    await expect(page).toHaveURL(/\/beheer\/wagenpark(\?verwijderd=1)?$/, { timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText('E2E Testauto')
    expect(errors).toEqual([])
  })
})
