# Browsertests (Playwright)

```bash
pnpm test:e2e                       # start zo nodig `pnpm dev` en test op http://localhost:3000
E2E_BASE_URL=http://localhost:3100 pnpm test:e2e   # tegen een draaiende productiebuild
DATABASE_URL=… E2E_BASE_URL=… pnpm test:e2e         # andere database dan in .env (dezelfde als die van de server)
pnpm test:e2e --project=desktop     # alleen desktop (1440 × 900)
pnpm test:e2e tests/e2e/a11y.spec.ts
```

Vereisten: de database uit `.env` (`DATABASE_URL`) is gemigreerd en gevuld
met `pnpm db:seed`, en Playwright heeft een Chromium-browser
(`pnpm exec playwright install chromium` als die er nog niet is).

**Draai deze tests niet tegen de productiedatabase.** Ze maken tijdelijk
gegevens aan:

- `global-setup.ts` maakt per run drie accounts (`eigenaar@`, `medewerker@`,
  `redacteur@e2e.goedgeregeld.test`) met willekeurige wachtwoorden; de
  wachtwoorden staan alleen in `tests/e2e/.artifacts/accounts.json`
  (genegeerd door git) zolang de run duurt.
- De tests maken aanvragen, blokkades en een testauto met foto’s aan, allemaal
  herkenbaar aan “E2E” in de naam.
- `global-teardown.ts` verwijdert de accounts, alles met “E2E” (inclusief de
  fotobestanden) en de rate-limittellers van lokale testverzoeken.

## Wat er getest wordt

| Bestand | Inhoud |
|---|---|
| `public.spec.ts` | homepage en alle autopagina’s (zonder JS-fouten of kapotte afbeeldingen), WhatsApp-links, galerij met toetsenbord, vergroting met Escape en focusherstel, terugknop, 404, verminderde beweging, beveiligingsheaders en noindex, aanvraagformulier (fouten, opslaan, geen succesmelding als de server faalt, en invoer van vóór het laden van de scripts blijft staan), mobiel menu (focus, Escape, scroll-lock, sluiten bij navigatie), geen horizontale overloop op 360–1920 px |
| `admin.spec.ts` | inloggen, doorsturen zonder sessie, rechten per rol, aanvraag bevestigen, overlap weigeren, blokkade over een reservering weigeren, testauto aanmaken, foto’s uploaden en sorteren, alt-tekst, prijs wijzigen, publiceren, offline halen en verwijderen; tegen een server met `VERCEL=1` ook een foto boven 4,5 MB die de browser eerst verkleint |
| `a11y.spec.ts` | axe-core (WCAG 2.2 A/AA) op alle publieke pagina’s en alle beheerpagina’s, inclusief alle tabbladen van een auto |

De server-side controle van rechten in de Server Actions zelf staat in
`tests/integration/action-permissions.test.ts` (onderdeel van `pnpm test`).
