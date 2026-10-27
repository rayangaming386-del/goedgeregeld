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
- **sharp** voor foto’s: controle op inhoud, EXIF-rotatie, metadata verwijderd, AVIF- en WebP-varianten in meerdere breedtes, aparte OG-afbeelding; opslag op schijf, in de database (Vercel) of in S3
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
| `pnpm deploy:prepare` | Vóór een build bij een deployment: instellingen controleren, migraties, bij de eerste installatie de startinhoud en het eerste eigenaar-account (zie hieronder) |
| `pnpm vercel-build` | Wat Vercel uitvoert (via `vercel.json`): `deploy:prepare` en daarna `next build` |

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

## Op Vercel zetten

De repository bevat een `vercel.json`. Vercel voert bij elke deployment eerst
`pnpm deploy:prepare` uit (instellingen controleren, migraties, de eerste keer
ook de startinhoud) en bouwt daarna de site. De serverfuncties draaien in
Frankfurt (`fra1`), dicht bij de klanten en bij de database.

**Eerst alleen kijken kan ook.** Zonder gekoppelde database bouwt Vercel een
voorbeeldversie: de complete website met de vier auto’s, foto’s en teksten uit
`bronmateriaal/`, zonder instellingen. Het beheer en het versturen van
aanvragen werken dan niet; dat staat ook op de website (het formulier meldt
“Niet verstuurd” en verwijst naar WhatsApp). Zodra er een database is
gekoppeld, wordt bij de volgende deployment de volledige versie gebouwd.

Eenmalig instellen voor de volledige versie:

1. **Database.** Vercel → het project → *Storage* → *Create Database* →
   **Neon** (Postgres). Kies de regio *Frankfurt (eu-central-1)*, koppel de
   database aan het project (in elk geval *Production*) en laat het
   voorvoegsel voor de variabelen leeg. Vercel zet dan zelf `DATABASE_URL` en
   `DATABASE_URL_UNPOOLED`.
2. **Instellingen.** *Settings → Environment Variables*, voor *Production*:
   - `APP_SECRET`: een willekeurige waarde van minstens 32 tekens
     (bijvoorbeeld de uitvoer van `openssl rand -base64 48`);
   - `SEED_OWNER_EMAIL` en `SEED_OWNER_PASSWORD` (minimaal 12 tekens) voor het
     eerste eigenaar-account, en eventueel `SEED_OWNER_NAME`.
3. **Deployen.** *Deployments → ⋯ → Redeploy*, of push naar `main`. De
   eerste build laadt de vier auto’s, de foto’s en de standaardteksten (ongeveer
   een minuut extra).
4. **Inloggen** op `https://<project>.vercel.app/beheer` met dat e-mailadres
   en wachtwoord. Je kiest direct een nieuw wachtwoord. Verwijder daarna
   `SEED_OWNER_EMAIL` en `SEED_OWNER_PASSWORD` weer uit de instellingen.

Goed om te weten:

- **Ontbreekt er iets** terwijl er wél een database is, dan stopt de build met
  een uitleg in gewone taal in de buildlog (bijvoorbeeld: `APP_SECRET` te kort).
- **Latere deployments overschrijven niets.** De startinhoud wordt alleen
  geladen in een database waar dat nog nooit is gebeurd en nog geen account
  bestaat; het eigenaar-account alleen zolang er nog geen enkel account is.
  Gelijktijdige builds wachten op elkaar (databaselock).
- **Foto’s** staan op Vercel in de database (`MEDIA_STORAGE=database`, daar de
  standaard) en gaan via het CDN van Vercel naar de bezoeker. De startinhoud is
  ±21 MB. Originelen zijn niet publiek op te vragen.
- **Uploads**: Vercel neemt maximaal 4,5 MB per verzoek aan. Het beheer
  verkleint grotere foto’s daarom eerst in de browser (JPEG, hooguit 4000
  pixels aan de lange kant; de website toont foto’s op maximaal 1920 pixels
  breed). Dat staat ook bij het uploadveld.
- **Conceptmodus**: de site staat op `noindex` tot de eigenaar hem in de
  Publicatiecheck live zet. Een eigen domein voeg je toe onder *Settings →
  Domains*; zet dan ook `SITE_URL` op dat domein. Zonder `SITE_URL` gebruiken
  gedeelde links het `vercel.app`-adres voor de voorbeeldafbeelding.
- **Preview-deployments** (andere branches) gebruiken de database die je aan
  *Preview* koppelt en voeren daar ook migraties op uit. Koppel voor Preview
  liever een aparte Neon-branch dan de productiedatabase.
- **Back-ups**: Neon kan terugzetten naar een eerder moment (hoe ver terug hangt
  af van het abonnement). Maak daarnaast periodiek een `pg_dump`; daarin
  zitten op Vercel ook de foto’s.
- **Wachtwoord van de enige eigenaar kwijt**: op een computer met de broncode
  `DATABASE_URL="<adres uit Neon>" pnpm user:reset-password --email …`.

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
  back-ups van). Zonder blijvende schijf (serverless, zoals Vercel):
  `MEDIA_STORAGE=database` (foto’s in PostgreSQL) of S3-compatibele opslag
  (`MEDIA_STORAGE=s3`, klaar voor aansluiting, nog niet tegen een echte bucket
  getest). Originelen zijn nooit publiek.
- **Uploadgrootte**: foto’s gaan per bestand (max. 12 MB) via een Server
  Action. Op Vercel (4,5 MB per verzoek) verkleint het beheer grotere foto’s
  eerst in de browser. Begrenst een andere proxy de verzoeken (bijvoorbeeld
  nginx `client_max_body_size`), zet die dan op minstens 13 MB.
- **Deployment-voorbereiding**: draai vóór elke `pnpm build` op een nieuwe
  versie `pnpm deploy:prepare` (migraties; bij een lege database ook de
  startinhoud). Op Vercel gebeurt dat automatisch.
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
