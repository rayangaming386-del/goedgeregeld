# Goed Geregeld Autoverhuur — website en beheer

Website en beheeromgeving voor Goed Geregeld Autoverhuur in Den Haag: vier
sportieve Audi’s, een aanvraagformulier dat aanvragen echt opslaat, en een
beveiligd beheer voor aanvragen, planning, wagenpark, foto’s, prijzen,
acties, teksten, gebruikers en de publicatiecheck.

De website staat standaard in **conceptmodus**: niet vindbaar voor
zoekmachines, met onbevestigde gegevens gemarkeerd als indicatie. Live zetten
gebeurt pas na de publicatiecheck in het beheer, door de eigenaar.

Zie ook:

- [`OPLEVERING.md`](OPLEVERING.md) — wat werkt, wat getest is, wat nog bevestigd moet worden;
- [`docs/visuele-richting.md`](docs/visuele-richting.md) — kleuren, typografie, beweging;
- [`tests/e2e/README.md`](tests/e2e/README.md) — de browsertests.

## Techniek

- **Next.js 16** (App Router, React 19, TypeScript), servercomponenten en Server Actions
- **PostgreSQL 15+** met Drizzle ORM; overlapcontrole voor bevestigde reserveringen in de database zelf (`btree_gist`-exclusieconstraint) én per auto met een transactielock
- **sharp** voor foto’s: controle op inhoud, EXIF-rotatie, metadata verwijderd, AVIF- en WebP-varianten in meerdere breedtes, aparte OG-afbeelding
- **GSAP** (ScrollTrigger, SplitText) voor beweging, pas geladen ná de eerste weergave
- Eigen sessies (gehashte tokens in de database, `HttpOnly`, `SameSite=Lax`, `__Host-`-cookie in productie) en **Argon2id**-wachtwoorden
- Vitest (unit en integratie tegen een echte testdatabase), Playwright + axe-core (browser en toegankelijkheid)

## Lokaal starten

Vereist: Node.js 20.9 of nieuwer, pnpm 10 en PostgreSQL 15 of nieuwer.

```bash
pnpm install
cp .env.example .env          # vul DATABASE_URL, TEST_DATABASE_URL en APP_SECRET in

# Databases aanmaken (voorbeeld met psql)
createdb goedgeregeld
createdb goedgeregeld_test

pnpm db:migrate               # tabellen, constraints en de btree_gist-extensie
pnpm db:seed                  # vier auto’s, foto’s (webvarianten) en standaardteksten
pnpm user:create --email eigenaar@voorbeeld.nl --name "Naam" --role eigenaar
                              # vraagt om een wachtwoord (minimaal 12 tekens)
pnpm dev                      # http://localhost:3000, beheer op /beheer
```

`btree_gist` moet beschikbaar zijn (standaard in PostgreSQL; de migratie voert
`CREATE EXTENSION IF NOT EXISTS btree_gist` uit, waarvoor de databasegebruiker
die rechten nodig heeft).

De seed is herhaalbaar: bestaande gegevens worden niet dubbel aangemaakt.
Met `--demo` komen er voorbeeldaanvragen en een onderhoudsblokkade bij,
herkenbaar aan “Demo –” in de naam. `--reset --yes` leegt eerst alles (in
productie alleen met `ALLOW_RESET=1`).

Extra accounts maakt de eigenaar in het beheer (Gebruikers, met een eenmalig
getoond tijdelijk wachtwoord) of via de opdrachtregel zoals hierboven. Zonder
`NEW_USER_PASSWORD` vraagt `user:create` om een wachtwoord; draait het zonder
terminal (bijvoorbeeld in een script), dan maakt het een tijdelijk wachtwoord
dat bij de eerste login gewijzigd moet worden.
Voor geautomatiseerde installaties kan de seed ook direct een eigenaar
aanmaken met `SEED_OWNER_EMAIL` en `SEED_OWNER_PASSWORD` (daarna weer
verwijderen uit de omgeving).

## Scripts

| Opdracht | Wat het doet |
|---|---|
| `pnpm dev` | Ontwikkelserver |
| `pnpm build` / `pnpm start` | Productiebuild en -server (de build leest de database, zie hieronder) |
| `pnpm typecheck` | TypeScript-controle |
| `pnpm test` | Unit- en integratietests (gebruikt `TEST_DATABASE_URL`, die database wordt geleegd) |
| `pnpm test:e2e` | Browsertests en toegankelijkheidsaudit met Playwright (zie `tests/e2e/README.md`) |
| `pnpm db:migrate` | Migraties uitvoeren |
| `pnpm db:seed` | Startinhoud laden |
| `pnpm db:generate` | Nieuwe migratie maken na een schemawijziging |
| `pnpm user:create` | Account aanmaken via de opdrachtregel |
| `pnpm user:reset-password --email …` | Nieuw wachtwoord voor een bestaand account (bijv. als de eigenaar het kwijt is); beëindigt alle sessies |

## Rollen

| Rol | Mag |
|---|---|
| Eigenaar | Alles, inclusief prijzen, acties, gebruikers, bevestigen van brongegevens en live zetten |
| Medewerker | Aanvragen behandelen, reserveringen, opties, kalender en blokkades |
| Redacteur | Auto’s, foto’s en website-teksten; geen prijzen, planning of gebruikers |

Rechten worden in elke beheerpagina en elke Server Action op de server
gecontroleerd; het verbergen van knoppen is alleen gemak.

Wachtwoord vergeten: een eigenaar zet voor een ander account een nieuw
tijdelijk wachtwoord via **Gebruikers**. Is de eigenaar zelf het wachtwoord
kwijt, dan kan iemand met servertoegang `pnpm user:reset-password --email …`
uitvoeren. Er is (bewust) geen herstel via e-mail zolang er geen
e-mailprovider is ingesteld.

## Van concept naar live

1. Controleer in **Wagenpark → Brongegevens** per auto de prijzen, borg,
   specificaties, voorwaarden, uitvoering en fotorechten en bevestig wat klopt.
2. Vul in **Publicatiecheck** de rekenregels in (dagtelling, btw) en bevestig
   logo, contactgegevens en teksten.
3. Publiceer de privacyverklaring (**Website-inhoud → Privacy en voorwaarden**)
   nadat de [aanvullen]-punten zijn ingevuld en de tekst is gecontroleerd.
4. Zet `SITE_URL` op het definitieve domein.
5. Zet in **Publicatiecheck** de website live, en daarna eventueel vindbaar.

Live verbergt de website alles wat niet bevestigd is, en auto’s waarvan de
fotorechten niet bevestigd zijn. De schakelaar verandert alleen wat de website
toont; hij zet de website niet op een domein of bij een hostingpartij.

## In productie draaien

- **Build leest de database.** Homepage, wagenpark en de autopagina’s worden
  bij de build vooraf opgebouwd (en daarna elke 5 minuten of direct na een
  wijziging in het beheer ververst). `DATABASE_URL` moet tijdens `pnpm build`
  bereikbaar zijn.
- **HTTPS is verplicht** voor het beheer: in productie gebruikt de sessie een
  `__Host-`-cookie met `Secure`. Voor een lokale test van een productiebuild
  over http: `SESSION_COOKIE_SECURE=false`.
- **APP_SECRET** (minimaal 32 tekens) is verplicht in productie.
- **Achter een proxy**: de rate limiting gebruikt het IP-adres dat de proxy
  achteraan in `X-Forwarded-For` zet. Staan er meerdere proxy’s achter elkaar
  (bijvoorbeeld een CDN vóór nginx), zet dan `TRUSTED_PROXY_HOPS` op dat aantal.
- **Foto’s**: met `MEDIA_STORAGE=local` op één server of VPS met een
  blijvende schijf (zet `MEDIA_LOCAL_DIR` buiten de deploymap en maak er
  back-ups van). Voor serverless hosting is S3-compatibele opslag nodig
  (`MEDIA_STORAGE=s3`, klaar voor aansluiting, nog niet tegen een echte bucket
  getest). Originelen zijn nooit publiek.
- **Uploadgrootte**: foto’s gaan per bestand (max. 12 MB) via een Server
  Action. Sommige platforms begrenzen request bodies lager (bijvoorbeeld 4,5 MB
  bij serverless functies op Vercel); kies dan een VPS of verklein foto’s vóór
  het uploaden.
- **E-mailmelding** bij een nieuwe aanvraag via Resend (optioneel, zie
  `.env.example`). Zonder melding staan aanvragen alleen in het beheer.
- **Back-ups**: maak dagelijks een back-up van de database (`pg_dump`) en van
  de map met foto’s.

## Projectindeling

```
src/
  app/(site)/          publieke website (homepage, wagenpark, aanvragen, juridisch)
  app/beheer/          beheeromgeving (login, dashboard, alle beheerpagina’s)
  app/media/           serveert webvarianten van foto’s (lokale opslag)
  components/          website-, beheer-, beweging- en mediacomponenten
  domain/              pure bedrijfslogica: tijd en zomertijd, prijzen,
                       beschikbaarheid, statussen, rechten, validatie, inhoud
  server/              database, authenticatie, reserveringen, wagenpark,
                       foto-pijplijn, opslag, publicatiecheck, gebruikers
  styles/              ontwerptokens, basisstijl en beheerstijl
drizzle/               SQL-migraties
scripts/               migratie, seed en accounts
tests/                 unit-, integratie- en browsertests
bronmateriaal/         het aangeleverde pakket (originele foto’s en notities)
```

## Beveiliging en privacy in het kort

- Geen tracking, geen advertentiecookies en dus geen cookiebanner; alleen het
  beheer gebruikt een noodzakelijke sessiecookie.
- Het aanvraagformulier vraagt geen identiteitsbewijs, rijbewijs of
  betaalgegevens. Aanvragen staan in de database, niet in de browser.
- Bescherming tegen spam en dubbele verzending (honeypot, minimale invultijd,
  rate limiting per gehasht IP-adres, herkenning van dezelfde aanvraag).
- Interne notities en planningsgegevens komen nooit in publieke pagina’s.
- Inloggen is beperkt tegen raden (per e-mailadres en per IP); een niet-bestaand
  account kost evenveel rekentijd als een bestaand.
- Strikte Content-Security-Policy, `frame-ancestors 'none'`, HSTS in productie,
  en `noindex` plus `no-store` op het hele beheer.
- Elke wijziging in het beheer komt in de wijzigingsgeschiedenis; teksten en
  autogegevens hebben eerdere versies die terug te zetten zijn.
