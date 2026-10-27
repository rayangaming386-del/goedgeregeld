# Oplevering — Goed Geregeld Autoverhuur

Stand van het project op 27 oktober 2026 (branch `claude/great-mayer-91j22m`).
De website is **niet gepubliceerd**: er is niets op een domein of bij een
hostingpartij gezet, en de site staat in conceptmodus (niet vindbaar).

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
| Aanvraag versturen | Validatie in browser én server, opslag in PostgreSQL, aanvraagnummer, herkenning van dubbele verzending, honeypot en minimale invultijd, rate limiting per gehasht IP-adres. Faalt de server of de verbinding, dan staat er “Niet verstuurd” met een WhatsApp-alternatief en blijven de ingevulde gegevens staan; er verschijnt nooit een succesmelding zonder opslag. |
| WhatsApp | Links naar +31 6 16161623 met een vooraf ingevuld bericht (auto, periode, naam, aanvraagnummer). |
| Statussen | Nieuw, in behandeling, wacht op klant, bevestigd, afgewezen, geannuleerd, afgerond, met toegestane overgangen en historie per aanvraag. |
| Planning | Aanvraag, tijdelijke optie (met vervaldatum), bevestigd, onderhoud en handmatige blokkade worden apart getoond en behandeld. Overlap wordt op de server gecontroleerd met een lock per auto én een database-constraint; ook twee beheerders die tegelijk bevestigen kunnen geen dubbele boeking maken (getest met 6 gelijktijdige pogingen). |
| Tijdzone | Alle tijden in Europe/Amsterdam; niet-bestaande tijden bij de zomertijdovergang worden geweigerd. |
| Kalender | Maand-, week- en (mobiel) agendaweergave, filter per auto, overlap gemarkeerd, blokkades toevoegen en verwijderen. |
| Wagenpark | Auto’s toevoegen, bewerken, publiceren, offline halen, archiveren, verwijderen (alleen zonder historie), volgorde, uitlichten, slug en zoekmachinegegevens, voorvertoning en eerdere versies terugzetten. |
| Foto’s | Upload met controle op de inhoud (JPEG, PNG, WebP, AVIF; max. 12 MB; min. 400 px), EXIF-rotatie, metadata verwijderd, AVIF- en WebP-varianten, OG-afbeelding, focuspunt met uitsnedevoorbeeld, volgorde, hoofdfoto, alt-tekst (verplicht voor publieke foto’s), vervangen en verwijderen. Originelen zijn nooit publiek. Watermerken blijven staan. |
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
| S3-compatibele foto-opslag | Bucket en sleutels (`MEDIA_STORAGE=s3`). Code en CSP-aanpassing zijn er; niet getest tegen een echte bucket. Nodig bij serverless hosting. |
| Domein en vindbaarheid | `SITE_URL` en daarna “Vindbaar maken” in de publicatiecheck. |
| Hosting | Een server met Node.js 20.9+ en PostgreSQL 15+ (zie README). Er is niets gedeployed. |

### Nog niet geïmplementeerd

- Online betalen, digitale contracten en het opvragen van documenten van klanten (bewust niet: het aanvraagformulier vraagt geen identiteitsbewijs, rijbewijs of betaalgegevens).
- Automatische e-mails of berichten aan klanten; contact loopt persoonlijk (WhatsApp of telefoon).
- Wachtwoordherstel via e-mail en tweestapsverificatie voor het beheer.
- Andere talen dan Nederlands.
- Bezoekersstatistieken (er wordt niets gemeten of gevolgd).

## 3. Uitgevoerde tests en metingen

_Wordt hieronder aangevuld met de uitkomsten van de laatste testrun._

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
| 13 | Domeinnaam, hosting en (optioneel) e-mailprovider | Zie README |
| 14 | Wie welk account en welke rol krijgt | Beheer → Gebruikers |
| 15 | Juridische check op het gebruik van de merknaam Audi en de modelnamen | Footer bevat een merkenverklaring |

## 5. Bekende beperkingen en aandachtspunten

- De prestatiemetingen zijn labmetingen op één machine; echte veldgegevens
  (Core Web Vitals van bezoekers) bestaan pas na livegang.
- `pnpm build` leest de database (vooraf opgebouwde pagina’s).
- Uploads tot 12 MB per foto: platforms met een lagere limiet voor request
  bodies (bijvoorbeeld serverless functies op Vercel, 4,5 MB) vragen een VPS of
  kleinere bestanden.
- De bepaling van het IP-adres voor rate limiting hangt af van
  `TRUSTED_PROXY_HOPS` (standaard één vertrouwde proxy).
- Een inloglimiet per e-mailadres kan bij veel foute pogingen van een ander
  tijdelijk (15 minuten) het inloggen op dat account blokkeren; de eigenaar kan
  dit opheffen met `pnpm user:reset-password`.
