# Oplevering — Goed Geregeld Autoverhuur

Stand van het project op 27 oktober 2026, op `main` (gelijk aan de
werkbranch `claude/great-mayer-91j22m`). Op verzoek van de eigenaar staat de
code op de branch die aan het Vercel-project gekoppeld is. Die deployment kon
ik van hieruit niet bekijken of controleren; wat er voor Vercel nodig is staat
in `README.md` (“Op Vercel zetten”), wat er getest is in §3. De site staat in
conceptmodus (niet vindbaar) tot de eigenaar hem in de publicatiecheck live zet.

## 1. Wat er is opgeleverd

- Publieke website: homepage (hero, tekstbalk, wagenpark, “Performance in
  detail”, hoe huren werkt, over ons, veelgestelde vragen, afsluitende oproep,
  footer), wagenparkoverzicht, vier autopagina’s met de aangeleverde foto’s,
  aanvraagpagina, privacy- en voorwaardenpagina (zichtbaar na goedkeuring),
  404- en foutpagina’s.
- Beheeromgeving op `/beheer` met drie rollen: dashboard, aanvragen, kalender,
  wagenpark met foto’s en brongegevens, acties, website-inhoud, gebruikers,
  wijzigingsgeschiedenis, publicatiecheck en eigen account.
- Broncode (Next.js 16, TypeScript, PostgreSQL), migraties, seed met de vier
  auto’s, installatie- en configuratie-instructies in `README.md`, voorbeeld-
  configuratie in `.env.example`, visuele richting in `docs/visuele-richting.md`.
- Geautomatiseerde tests: unit, integratie (tegen een echte database), browser
  (Playwright) en toegankelijkheid (axe-core). Zie §3.

## 2. Status per onderdeel

### Volledig werkend

| Onderdeel | Toelichting |
|---|---|
| Aanvraag versturen | Validatie in browser én server, opslag in PostgreSQL, aanvraagnummer, herkenning van dubbele verzending, honeypot en minimale invultijd, rate limiting per gehasht IP-adres. Faalt de server of de verbinding, dan staat er “Niet verstuurd” met een WhatsApp-alternatief en blijven de ingevulde gegevens staan; er verschijnt nooit een succesmelding zonder opslag. Wat al is ingevuld voordat de pagina helemaal geladen is (trage verbinding, automatisch invullen door de browser), blijft staan. |
| WhatsApp | Links naar +31 6 16161623 met een vooraf ingevuld bericht (auto, periode, naam, aanvraagnummer). |
| Statussen | Nieuw, in behandeling, wacht op klant, bevestigd, afgewezen, geannuleerd, afgerond, met toegestane overgangen en historie per aanvraag. |
| Planning | Aanvraag, tijdelijke optie (met vervaldatum), bevestigd, onderhoud en handmatige blokkade worden apart getoond en behandeld. Overlap wordt op de server gecontroleerd met een lock per auto én een database-constraint; ook twee beheerders die tegelijk bevestigen kunnen geen dubbele boeking maken (getest met 6 gelijktijdige pogingen). |
| Tijdzone | Alle tijden in Europe/Amsterdam; niet-bestaande tijden bij de zomertijdovergang worden geweigerd. |
| Kalender | Maand-, week- en (mobiel) agendaweergave, filter per auto, overlap gemarkeerd, blokkades toevoegen en verwijderen. |
| Wagenpark | Auto’s toevoegen, bewerken, publiceren, offline halen, archiveren, verwijderen (alleen zonder historie), volgorde, uitlichten, slug en zoekmachinegegevens, voorvertoning en eerdere versies terugzetten. |
| Foto’s | Upload met controle op de inhoud (JPEG, PNG, WebP, AVIF; max. 12 MB; min. 400 px), EXIF-rotatie, metadata verwijderd, AVIF- en WebP-varianten, OG-afbeelding, focuspunt met uitsnedevoorbeeld, volgorde, hoofdfoto, alt-tekst (verplicht voor publieke foto’s), vervangen en verwijderen. Opslag op schijf of in de database (`MEDIA_STORAGE=database`, standaard op Vercel, met CDN-caching). Waar de hosting maximaal 4,5 MB per verzoek aanneemt (Vercel), verkleint de browser grotere foto’s eerst. Originelen zijn nooit publiek. Watermerken blijven staan. |
| Deployment-voorbereiding | `pnpm deploy:prepare` (op Vercel automatisch): controleert de instellingen met uitleg in gewone taal, voert migraties uit onder een databaselock, laadt de startinhoud alleen bij een lege database en maakt het eerste eigenaar-account alleen zolang er geen account is (wachtwoord bij de eerste login wijzigen). |
| Prijzen en acties | Centrale prijzen per auto; acties met periode, actieprijs of percentage en controle op overlap. De website rekent alleen met regels die de eigenaar heeft bevestigd. |
| Publicatiecheck | Bevestigingen per auto (dagprijs, borg, overige tarieven, specificaties, voorwaarden, uitvoering, fotorechten) en voor logo, contactgegevens en teksten; rekenregels (dagtelling, btw); concept → live → vindbaar. Live verbergt alles wat niet bevestigd is. |
| Website-inhoud | Teksten en beelden per homepage-sectie met lengtelimieten en live voorvertoning (telefoon en desktop), veelgestelde vragen, privacyverklaring en voorwaarden met goedkeuring door de eigenaar, eerdere versies terugzetten. |
| Gebruikers en rollen | Eigenaar, medewerker en redacteur, op de server afgedwongen in elke pagina en Server Action; accounts met eenmalig getoond tijdelijk wachtwoord; altijd minstens één actieve eigenaar. |
| Inloggen | Argon2id, gehashte sessietokens in de database, `__Host-`-cookie in productie, limieten per account, per IP en per e-mailadres, wachtwoordherstel via `pnpm user:reset-password`. |
| Wijzigingsgeschiedenis | Elke wijziging met wie, wat en wanneer, met van/naar-overzicht en filters. |
| SEO | Titels, beschrijvingen, canonieke adressen (met `SITE_URL`), Open Graph-afbeeldingen, gestructureerde data alleen met bekende gegevens, robots.txt en sitemap gekoppeld aan de publicatiestand. |
| Toegankelijkheid | Toetsenbord, zichtbare focus, skiplinks, beschrijvende labels, foutsamenvatting in formulieren, verminderde beweging; axe-core WCAG 2.2 A/AA zonder bevindingen (zie §3). |
| Beweging | CSS-intro van de hero, GSAP-scrollanimaties (na de eerste weergave geladen), pauzeerbare tekstbalk, vaste beeldsectie op desktop met een verticale variant op mobiel. |

### Werkend met demonstratiedata

| Onderdeel | Herkomst en wat er nog moet gebeuren |
|---|---|
| Prijzen, borg, specificaties en voorwaarden van de vier auto’s | Overgenomen uit de Central Rental-listings (een tussenpersoon). In conceptmodus gemarkeerd als indicatie; op de live site verborgen tot de eigenaar ze bevestigt. |
| Foto’s | Van de Central Rental-galerijen, watermerken behouden. Drie promotiebeelden met tekst (telefoonnummer, claims, vlaggen) staan op “niet publiek”. Gebruiksrecht moet de eigenaar bevestigen. |
| Teksten | Nieuw geschreven conceptteksten, zonder verzonnen geschiedenis, reviews of claims. Door de eigenaar te lezen en te bevestigen. |
| Veelgestelde vragen | Vier gepubliceerd (alleen over het proces), zeven in concept met [aanvullen]-markeringen; concepten zijn niet zichtbaar. |
| Privacyverklaring | Concept met [aanvullen]-punten (bedrijfsgegevens, bewaartermijn); kan pas gepubliceerd worden als die zijn ingevuld. |
| Huurvoorwaarden | Alleen een plaatshouder; de eigenaar levert de tekst. |
| Voorbeeldaanvragen | Alleen met `pnpm db:seed --demo`, herkenbaar aan “Demo –”. |

### Klaar voor aansluiting

| Onderdeel | Wat er nodig is |
|---|---|
| E-mailmelding bij een nieuwe aanvraag | Resend-account, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO`. De code is er; niet getest met een echte sleutel. |
| Voorbeeldversie zonder database | Zonder `DATABASE_URL` bouwt de deployment de website met de startinhoud (foto’s als vaste bestanden); beheer en aanvragen staan uit en de website zegt dat. Lokaal getest als Vercel-build zonder enige instelling: alle pagina’s 200, geen kapotte beelden of consolefouten op desktop en mobiel, het formulier toont “Niet verstuurd” en nooit een succesmelding. |
| Vercel | `vercel.json` (build met voorbereiding, regio Frankfurt), foto’s in de database en het verkleinen van grote uploads zijn er en zijn getest in een nagebootste Vercel-omgeving (§3). Op het echte Vercel-platform heb ik niets kunnen testen. Nodig: een Neon-database koppelen, `APP_SECRET` en voor het eerste account `SEED_OWNER_EMAIL` en `SEED_OWNER_PASSWORD` (README → “Op Vercel zetten”). |
| S3-compatibele foto-opslag | Bucket en sleutels (`MEDIA_STORAGE=s3`). Code en CSP-aanpassing zijn er; niet getest tegen een echte bucket. Alternatief voor opslag in de database. |
| Domein en vindbaarheid | `SITE_URL` en daarna “Vindbaar maken” in de publicatiecheck. |
| Andere hosting | Een server met Node.js 20.9+ en PostgreSQL 15+ (zie README). |

### Nog niet geïmplementeerd

- Online betalen, digitale contracten en het opvragen van documenten van klanten (bewust niet: het aanvraagformulier vraagt geen identiteitsbewijs, rijbewijs of betaalgegevens).
- Automatische e-mails of berichten aan klanten; contact loopt persoonlijk (WhatsApp of telefoon).
- Wachtwoordherstel via e-mail en tweestapsverificatie voor het beheer.
- Andere talen dan Nederlands.
- Bezoekersstatistieken (er wordt niets gemeten of gevolgd).

## 3. Uitgevoerde tests en metingen

Alle cijfers hieronder komen uit runs die echt zijn uitgevoerd op 27 oktober
2026, lokaal, met de seedgegevens. Er zijn geen metingen op een echte server,
op Vercel of bij echte bezoekers gedaan.

### Geautomatiseerde tests

| Suite | Uitkomst | Wat er getest wordt |
|---|---|---|
| `pnpm typecheck` | geslaagd | TypeScript strict, inclusief gegenereerde routetypes |
| `pnpm test` — unit (63) | 63/63 geslaagd | tijd en zomertijd (11), beschikbaarheid en statusovergangen (12), prijsberekening, weekend/week, acties (21), rechten per rol en validatie van aanvragen (14), IP-bepaling achter een proxy (3), lokale opslag en padbeveiliging (2) |
| `pnpm test` — integratie (36), tegen een echte PostgreSQL-testdatabase | 36/36 geslaagd | reserveringen: dubbele aanvragen, overlap, aansluitende periodes, 6 gelijktijdige bevestigingen waarvan er precies één slaagt, de database-constraint, opties en verlopen, blokkades, statushistorie, interne notities niet publiek (15); gebruikersbeheer inclusief twee eigenaren die elkaar tegelijk degraderen, bevestigingen die vervallen na een wijziging, publiceren zonder foto geweigerd, live-regels (10); rechten in de Server Actions zelf per rol, met controle dat de database bij een weigering niet verandert (8); foto’s in de database: byte voor byte bewaren en verwijderen, serveren via `/media` met CDN-cacheheader, origineel niet op te vragen, keuze van de opslag (3) |
| `pnpm test:e2e` — Playwright, Chromium, desktop 1440×900 en mobiel 390×844 | 40 geslaagd, 0 mislukt, 16 bewust niet uitgevoerd — zowel tegen `pnpm dev` (foto’s op schijf) als tegen de Vercel-simulatie hieronder (productiebuild, foto’s in de database) | zie `tests/e2e/README.md`; niet uitgevoerd: de beheertests op mobiel, de menutests op desktop en de breedtetest op mobiel (die stelt zelf de breedtes in). Tegen de Vercel-simulatie loopt ook de upload van een foto van ruim 4,5 MB mee. |
| Toegankelijkheid — axe-core 4.11, WCAG 2.0/2.1/2.2 A en AA | 0 bevindingen | 6 publieke pagina’s (inclusief de 404) en 26 beheerpagina’s (inclusief de inlogpagina, een aanvraag en alle tabbladen van een auto), op desktop en mobiel |

Controles op de tests zelf:

- De axe-meting is gecontroleerd met opzettelijk ingevoegde fouten (afbeelding
  zonder alt, knop zonder naam, te weinig contrast): alle drie gevonden.
- De gelijktijdigheidstest voor eigenaren faalt als de lock wordt weggehaald;
  de rechtentest faalt als de controle in `updatePricingAction` wordt
  verzwakt. Beide zijn daarna teruggezet.
- De test “wat al is ingevuld voordat de pagina interactief is, blijft staan”
  faalt met de vorige versie van het aanvraagformulier (de begindatum is dan
  leeg) en slaagt met de huidige.

### Vercel nagebootst

Op het echte Vercel-platform kon ik niets testen. Wel nagebootst, lokaal:

- **Eerste deployment**: een schone kopie met alleen de bestanden uit git,
  `pnpm install --frozen-lockfile`, een lege PostgreSQL 16-database en
  `VERCEL=1 VERCEL_ENV=production pnpm vercel-build`. Resultaat: migraties
  uitgevoerd, vier auto’s en 26 foto’s geladen (246 bestanden, 20 MB in de
  database), eigenaar-account aangemaakt met verplichte wachtwoordwijziging,
  alle 26 pagina’s gebouwd; samen 57 seconden.
- **Ontbrekende instellingen** (geen database, geen `APP_SECRET`, alleen
  `SEED_OWNER_EMAIL`): de build stopt vóór het bouwen, met per punt een uitleg
  wat er in Vercel moet gebeuren.
- **Volgende deployments**: wijzigingen uit het beheer blijven staan (een
  aangepaste tekst, een verwijderde veelgestelde vraag komt niet terug); het
  eigenaar-account wordt niet opnieuw aangemaakt.
- **Twee gelijktijdige eerste builds**: één laadt de startinhoud, de andere
  wacht en slaat die daarna over (4 auto’s, 26 foto’s, 1 account).
- **In de browser** (productieserver met `VERCEL=1`): eerste login met
  verplicht nieuw wachtwoord; een foto van 8,3 MB wordt in de browser verkleind
  tot 1,7 MB (3000 × 4000) en opgeslagen, ook bij “Foto vervangen”; een aanvraag
  wordt opgeslagen; geen fouten in de browserconsole. Foto’s komen uit de
  database met `Cache-Control: public, max-age=31536000, s-maxage=86400,
  immutable`; de deelafbeelding gebruikt het `vercel.app`-adres.

Niet getest: het CDN en de limieten van Vercel zelf, de regio-instelling, en
Neon (pooler en verbindingsadres).

### In de browser gecontroleerd

- Screenshots per sectie (homepage, wagenpark, autopagina, aanvraagpagina) op
  360, 390, 430, 768, 1024, 1280, 1440 en 1920 px. Gevonden en opgelost: de
  kop van de aanvraagpagina brak midden in een woord en liep op desktop onder
  het formulier; de galerij op de autopagina was smaller dan de kolom; de
  knoppen op de autopagina braken over twee regels; telefoonnummers braken
  midden in het nummer. Daarna nergens horizontale overloop (ook automatisch
  getest op alle acht breedtes).
- Accountflow: aanmaken met eenmalig tijdelijk wachtwoord, inloggen, verplicht
  eigen wachtwoord kiezen, rechten van de rol, deactiveren (direct overal
  uitgelogd), daarna inloggen geweigerd met een algemene melding.
- Publicatiecheck: bevestigen en intrekken, rekenregels kunnen niet bevestigd
  worden zonder keuzes, live zetten geblokkeerd zolang er open punten zijn.
- Beweging: na doorscrollen zijn alle onthulde elementen zichtbaar (desktop en
  mobiel); met verminderde beweging is alles direct zichtbaar; geen
  consolefouten. Na opslaan in het beheer blijft de toetsenbordfocus op de knop.

Tijdens het testen gevonden en opgelost: wat een bezoeker invulde voordat de
pagina geladen was (trage verbinding, automatisch invullen), werd na het laden
gewist; de IP-bepaling voor rate limiting was
te omzeilen met een zelf meegestuurde `X-Forwarded-For`; `.gitignore` sloot
een bronbestand uit (gecontroleerd met een verse clone); in het beheer startte
elke pagina ongeveer 60 server-renders door prefetchen (nu 15–20 verzoeken in
totaal); de focus verdween na opslaan; bij een verbroken verbinding ging het
ingevulde aanvraagformulier verloren; een eigenaar die het wachtwoord kwijt is
kon niet meer inloggen (nu `pnpm user:reset-password`).

### Prestaties (Lighthouse 12.8.2, Chromium 153, lokaal)

Per pagina en profiel drie runs; in de tabel de mediaan. Gemeten vóór de
Vercel-aanpassingen, tegen `pnpm build && pnpm start` met foto’s op schijf;
daarna niet opnieuw gemeten.

- **Desktop**: Lighthouse-desktopprofiel.
- **Mobiel, gesimuleerd**: het standaard mobiele profiel van Lighthouse (en
  PageSpeed Insights): 4× tragere CPU en een gesimuleerde trage 4G-verbinding.
- **Mobiel, toegepast**: hetzelfde profiel, maar met echt toegepaste
  vertraging (DevTools-throttling) in plaats van simulatie.

| Pagina | Profiel | Performance | FCP | LCP | TBT | CLS |
|---|---|---:|---:|---:|---:|---:|
| Homepage | desktop | 99 | 0,38 s | 0,82 s | 7 ms | 0 |
| | mobiel, gesimuleerd | 92 | 1,37 s | 2,95 s | 123 ms | 0 |
| | mobiel, toegepast | 91 | 1,14 s | 2,13 s | 332 ms | 0,003 |
| Wagenpark | desktop | 100 | 0,33 s | 0,75 s | 3 ms | 0 |
| | mobiel, gesimuleerd | 90 | 1,22 s | 3,56 s | 117 ms | 0 |
| | mobiel, toegepast | 92 | 1,06 s | 2,39 s | 266 ms | 0 |
| Audi RS3 Sportback | desktop | 99 | 0,38 s | 0,83 s | 3 ms | 0 |
| | mobiel, gesimuleerd | 93 | 1,36 s | 3,05 s | 125 ms | 0 |
| | mobiel, toegepast | 87 | 1,28 s | 2,52 s | 409 ms | 0 |
| Aanvragen | desktop | 100 | 0,33 s | 0,51 s | 4 ms | 0 |
| | mobiel, gesimuleerd | 94 | 1,21 s | 2,96 s | 87 ms | 0 |
| | mobiel, toegepast | 95 | 1,09 s | 1,09 s | 260 ms | 0,001 |

Toegankelijkheid en best practices: 100 op alle gemeten pagina’s en profielen.
SEO: 66 op alle pagina’s, uitsluitend door de bewuste `noindex` in
conceptmodus (de enige afgekeurde controle is “pagina mag geïndexeerd
worden”).

Beoordeling tegen de doelen: CLS blijft overal ruim onder 0,1. De LCP-doelwaarde
van 2,5 s wordt gehaald op desktop en met toegepaste mobiele vertraging (op de
autopagina met 2,52 s net niet), maar **niet** in de gesimuleerde mobiele
meting (2,95–3,56 s). Het grootste beeld bovenaan wordt daar al met voorrang
geladen; de rest is vooral de JavaScript van React/Next.js op een
gesimuleerd traag toestel. INP is in een labmeting niet te meten; TBT is de
benadering. Echte veldwaarden volgen pas na livegang.

## 4. Opleverlijst: te bevestigen of aan te leveren door de eigenaar

| # | Wat | Waar het nu staat |
|---|---|---|
| 1 | Dagprijs, borg, weekend- en weektarief en eventuele extra kosten per auto | Indicaties uit Central Rental; bevestigen in Wagenpark → Brongegevens |
| 2 | Of prijzen inclusief of exclusief btw zijn, en hoe huurdagen tellen (per 24 uur of per kalenderdag) | Publicatiecheck → Rekenregels (nu onbekend; geen berekening op de site) |
| 3 | Specificaties per auto (vermogen, koppel, 0–100, transmissie, bouwjaar) en uitvoering (SQ8 Stage 2 met downpipe, RS Q3 10 Years Edition met downpipe) | Volgens opgave van de tussenpersoon; niet als fabrieksspecificatie gepresenteerd |
| 4 | Minimumleeftijd (21+?), eventuele eis aan jaren rijbewijsbezit, kilometerregeling (kilometervrij?), kentekenland | Volgens opgave; bevestigen |
| 5 | Toestemming voor het gebruik van de foto’s, en bij voorkeur originele bestanden | Fotorechten zijn een verplicht punt vóór livegang |
| 6 | Toestemming voor het logo en een vectorbestand (SVG of PDF) | Nu een uitgesneden versie van de aangeleverde afbeelding |
| 7 | Bevestiging dat WhatsApp/telefoon (+31 6 16161623) en Instagram (@goed.geregeld) van Goed Geregeld zelf zijn | Verplicht punt vóór livegang |
| 8 | E-mailadres voor klanten (optioneel) | Leeg; wordt niet getoond |
| 9 | Bedrijfsgegevens voor de privacyverklaring: volledige naam, adres, KvK-nummer, e-mailadres voor privacyvragen, bewaartermijnen | Plaatshouders in de concepttekst |
| 10 | Huurvoorwaarden (borg, eigen risico, verzekering, annulering, buitenland, brandstof) | Nog niet aangeleverd |
| 11 | Antwoorden op de zeven conceptvragen | Website-inhoud → Veelgestelde vragen |
| 12 | Afhaallocatie en eventuele bezorging | Bewust niet op de website |
| 13 | Domeinnaam en (optioneel) e-mailprovider; voor Vercel een gekoppelde Neon-database, `APP_SECRET` en het eerste account | README → “Op Vercel zetten” |
| 14 | Wie welk account en welke rol krijgt | Beheer → Gebruikers |
| 15 | Juridische check op het gebruik van de merknaam Audi en de modelnamen | Footer bevat een merkenverklaring |

## 5. Bekende beperkingen en aandachtspunten

- De prestatiemetingen zijn labmetingen op één machine; echte veldgegevens
  (Core Web Vitals van bezoekers) bestaan pas na livegang.
- `pnpm build` leest de database (vooraf opgebouwde pagina’s); op Vercel wordt
  die vóór de build voorbereid.
- Op Vercel worden foto’s boven 4 MB in de browser verkleind (JPEG, hooguit
  4000 pixels aan de lange kant); die versie wordt dan als origineel bewaard. Een HEIC-foto die
  de browser niet kan lezen, moet eerst als JPEG worden geëxporteerd.
- Foto’s in de database maken de database groter (nu ±21 MB). Bij veel meer
  foto’s is S3-opslag een alternatief.
- Preview-deployments op Vercel voeren migraties uit op de database die aan
  Preview gekoppeld is; koppel daar liever een aparte Neon-branch.
- De bepaling van het IP-adres voor rate limiting hangt af van
  `TRUSTED_PROXY_HOPS` (standaard één vertrouwde proxy).
- Een inloglimiet per e-mailadres kan bij veel foute pogingen van een ander
  tijdelijk (15 minuten) het inloggen op dat account blokkeren; de eigenaar kan
  dit opheffen met `pnpm user:reset-password`.
