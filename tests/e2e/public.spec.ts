import { expect, test } from '@playwright/test'
import { brokenImages, horizontalOverflow, watchErrors } from './helpers'

const VEHICLES = ['audi-rs3-sportback', 'audi-rs-q3', 'audi-sq5', 'audi-sq8']
const WHATSAPP = /^https:\/\/wa\.me\/31616161623\?text=/

test.describe('website', () => {
  test('homepage laadt zonder fouten en toont alle vier de auto’s', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Sportieve Audi’s')
    for (const slug of VEHICLES) await expect(page.locator(`a[href="/wagenpark/${slug}"]`).first()).toBeAttached()
    const wa = await page.locator('a[href*="wa.me"]').first().getAttribute('href')
    expect(wa).toMatch(WHATSAPP)
    expect(await brokenImages(page)).toEqual([])
    expect(errors).toEqual([])
  })

  test('elke autopagina heeft een galerij, prijsinformatie en werkende afbeeldingen', async ({ page }) => {
    const errors = watchErrors(page)
    for (const slug of VEHICLES) {
      const res = await page.goto(`/wagenpark/${slug}`)
      expect(res?.status()).toBe(200)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.getByRole('region', { name: /Foto’s van de/ })).toBeVisible()
      await expect(page.locator('a[href*="wa.me"]').first()).toHaveAttribute('href', WHATSAPP)
      expect(await brokenImages(page)).toEqual([])
    }
    expect(errors).toEqual([])
  })

  test('galerij werkt met toetsenbord en de vergroting sluit met Escape', async ({ page }) => {
    await page.goto('/wagenpark/audi-sq8')
    const gallery = page.getByRole('region', { name: /Foto’s van de/ })
    const scroller = gallery.locator('[tabindex="0"][aria-label^="Foto 1 van"]')
    await scroller.focus()
    await page.keyboard.press('ArrowRight')
    await expect(gallery.locator('[aria-label^="Foto 2 van"]')).toBeAttached()
    await gallery.getByRole('button', { name: /^Toon foto 3/ }).click()
    await expect(gallery.locator('[aria-label^="Foto 3 van"]')).toBeAttached()

    const trigger = gallery.getByRole('button', { name: 'Foto vergroot bekijken' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: /vergroot/ })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('terugknop brengt je terug naar de vorige pagina', async ({ page }) => {
    await page.goto('/')
    await page.goto('/wagenpark')
    await page.locator('a[href="/wagenpark/audi-sq5"]').first().click()
    await expect(page).toHaveURL(/\/wagenpark\/audi-sq5$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/wagenpark$/)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('onbekende auto geeft een 404 met uitweg', async ({ page }) => {
    const res = await page.goto('/wagenpark/bestaat-niet')
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('link', { name: 'Bekijk het wagenpark' })).toBeVisible()
  })

  test('met verminderde beweging is alles direct zichtbaar en staat de tekstbalk stil', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], [data-reveal] > *')].filter((e) => getComputedStyle(e).opacity !== '1').length)
    expect(hidden).toBe(0)
    const marqueeMoving = await page.evaluate(() => document.querySelector('[data-animated="true"]') !== null)
    expect(marqueeMoving).toBe(false)
  })

  test('beveiligingsheaders en noindex in conceptmodus', async ({ request }) => {
    const home = await request.get('/')
    const h = home.headers()
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    const admin = await request.get('/beheer/login')
    expect(admin.headers()['x-robots-tag']).toContain('noindex')
    expect(admin.headers()['cache-control']).toContain('no-store')
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toMatch(/Disallow: \/\s*$/m)
  })
})

test.describe('aanvraagformulier', () => {
  test('toont fouten bij een leeg formulier en slaat een geldige aanvraag op', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/aanvragen?auto=audi-rs3-sportback')
    const form = page.locator('form').filter({ has: page.locator('input[name="name"]') })
    await form.locator('input[name="name"]').click()
    await form.getByRole('button', { name: 'Verstuur aanvraag' }).click()
    const summary = form.getByRole('alert').first()
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('velden hebben aandacht nodig')

    // Geldige aanvraag: over 40 tot 42 dagen, met een uniek nummer zodat er geen dubbele aanvraag ontstaat.
    const day = (offset: number) => {
      const d = new Date(Date.now() + offset * 86_400_000)
      return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
    }
    await form.locator('input[name="startDate"]').fill(day(40))
    await form.locator('input[name="startTime"]').fill('10:00')
    await form.locator('input[name="endDate"]').fill(day(42))
    await form.locator('input[name="endTime"]').fill('10:00')
    await form.locator('input[name="name"]').fill('E2E Testklant')
    await form.locator('input[name="phone"]').fill(`06${String(Date.now()).slice(-8)}`)
    // De server weigert verzendingen binnen 2,5 seconden na het eerste invullen.
    await page.waitForTimeout(3000)
    await form.getByRole('button', { name: 'Verstuur aanvraag' }).click()
    const success = page.getByRole('status').filter({ hasText: 'Aanvraag ontvangen' })
    await expect(success).toBeVisible({ timeout: 15_000 })
    await expect(success).toContainText(/GG-[A-Z0-9]{6}/)
    await expect(success).toContainText('Dit is nog geen reservering')
    expect(errors).toEqual([])
  })

  test('toont geen succes als de server niets heeft opgeslagen', async ({ page }) => {
    await page.goto('/aanvragen?auto=audi-sq5')
    // Elke POST (de Server Action) faalt, zoals bij een onbereikbare server.
    await page.route('**/aanvragen**', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500, body: 'fout' }) : route.continue()))
    const form = page.locator('form').filter({ has: page.locator('input[name="name"]') })
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
    await form.locator('input[name="startDate"]').fill(day(50))
    await form.locator('input[name="startTime"]').fill('10:00')
    await form.locator('input[name="endDate"]').fill(day(51))
    await form.locator('input[name="endTime"]').fill('10:00')
    await form.locator('input[name="name"]').fill('E2E Storing')
    await form.locator('input[name="phone"]').fill('0612345678')
    await page.waitForTimeout(3000)
    await form.getByRole('button', { name: 'Verstuur aanvraag' }).click()
    await expect(page.getByText('Niet verstuurd')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Stuur je aanvraag via WhatsApp' })).toHaveAttribute('href', WHATSAPP)
    await expect(page.getByText('Aanvraag ontvangen')).toHaveCount(0)
  })
})

test.describe('mobiel menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'alleen op mobiel')

  test('opent, vangt de focus, sluit met Escape en geeft de focus terug', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('button[aria-controls="mobiel-menu"]')
    await expect(page.locator('#mobiel-menu a').first()).toBeHidden()
    await button.click()
    const menu = page.locator('#mobiel-menu')
    await expect(menu).toBeVisible()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const scrollLocked = await page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden')
    expect(scrollLocked).toBe(true)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(button).toBeFocused()
  })

  test('sluit bij het kiezen van een pagina', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[aria-controls="mobiel-menu"]').click()
    await page.locator('#mobiel-menu').getByRole('link', { name: 'Wagenpark' }).first().click()
    await expect(page).toHaveURL(/\/wagenpark$/)
    await expect(page.locator('#mobiel-menu')).toBeHidden()
  })
})

test.describe('breedtes', () => {
  test.skip(({ isMobile }) => isMobile, 'stelt zelf de breedtes in')

  for (const width of [360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    test(`geen horizontale overloop op ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/wagenpark', '/wagenpark/audi-rs-q3', '/aanvragen']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        expect(await horizontalOverflow(page), `${path} op ${width}px`).toBeLessThanOrEqual(0)
      }
    })
  }
})
