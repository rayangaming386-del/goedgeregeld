# Visuele richting — “Showroom bij nacht”

Vastgelegd vóór de implementatie. De tokens staan in `src/styles/tokens.css`; dit document legt uit waarom.

## Uitgangspunt

Alle aangeleverde foto’s zijn gemaakt in dezelfde lichte showroom: witte wanden, betonvloer en een plafond van zeshoekige LED-lijnen. De zeshoek komt terug in de honingraatstiksels van de RS-stoelen en de grille van de RS3. De website is de nachtversie van die showroom: diep antraciet, met de auto’s als lichtbron. De zeshoek keert terug als fijn technisch detail (marquee-scheiding, voortgangsindicator, beeldkaders), nooit als behang.

De meeste foto’s zijn staand (3:4). Daarom werken composities met **staande beeldvlakken** naast typografie, in plaats van liggende achtergronden die de auto wegsnijden.

## Kleur en functie

| Token | Waarde | Functie |
|---|---|---|
| `--c-night` | `#0B0B0C` | Diepste vlak: hero, menu, footer |
| `--c-ink` | `#111214` | Basisachtergrond |
| `--c-graphite` | `#17181B` | Wisselende sectie |
| `--c-carbon` | `#1E1F23` | Verhoogde vlakken: kaarten, velden |
| `--c-steel` | `#2A2C31` | Sterke scheiding op verhoogde vlakken |
| `--c-line` | bone 14% | Haarlijnen |
| `--c-bone` | `#EEEAE2` | Gebroken wit: hoofdtekst, lichte sectie |
| `--c-bone-2` | `#C9C4BA` | Secundaire tekst (≥ 9,4:1 op donker) |
| `--c-bone-3` | `#9C978D` | Metatekst (≥ 5,6:1 op donker) |
| `--c-champagne` | `#C8B37E` | Enige accent, afgeleid van het logo |
| `--c-champagne-hi` | `#DCCB9A` | Hover op accent |
| `--c-champagne-deep` | `#6E5D33` | Accent op lichte ondergrond (5,3:1) |

Statuskleuren bestaan alleen in de beheeromgeving en worden altijd met tekst en icoon gecombineerd.

Gemeten contrast (WCAG): bone op ink 15,6:1 · bone-3 op carbon 5,7:1 · champagne op ink 9,1:1 · donkere tekst op champagne 9,1:1.

## Typografie

Twee families, zelf gehost en gesubset (geen verzoeken naar Google):

- **Archivo** (variabel, breedte 100–125, gewicht 300–800, 52 KB). Koppen in de *Expanded*-breedte (125) met strakke spatiëring: de brede, lage letter past bij automotive zonder een merk te imiteren. Lopende tekst in normale breedte.
- **IBM Plex Mono** (400/500). Uitsluitend voor technische labels, specificaties en tellers: de “specificatiekaart”.

| Rol | Grootte (mobiel → desktop) | Regelhoogte |
|---|---|---|
| Display | 44 → 120 px | 0,94 |
| H1 | 36 → 80 px | 1,0 |
| H2 | 30 → 60 px | 1,04 |
| H3 | 22 → 32 px | 1,12 |
| Lead | 18 → 22 px | 1,45 |
| Body | 17 px | 1,6 |
| Small | 15 px | 1,5 |
| Label (mono, kapitalen) | 12 → 13 px, +0,14em | 1,3 |

Geen tekst kleiner dan 12 px. Lopende tekst maximaal ±62 tekens per regel.

## Maatvoering

- Container: max. 1440 px; zijmarge `--gutter` 16 → 40 px.
- Tekstkolom: max. 40rem. FAQ-kolom: max. 52rem.
- Spacing-schaal op 4 px-basis: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- Sectiewit: 80 → 160 px verticaal, afhankelijk van het schermformaat.

## Vorm, lijnen en randen

- Beeld en kaarten: **scherpe hoeken** (0). Knoppen en velden: 2 px — net genoeg om niet te kartelen.
- Eén uitzondering: pillen (999 px) voor statuslabels en filterchips.
- 1 px haarlijnen in `--c-line`; champagne-lijn alleen voor actieve of geselecteerde staat.
- Technisch detail: kleine hoekmarkeringen rond belangrijke beelden (zoals een zoeker), modelcodes in mono.

## Knoppen

| Variant | Gebruik |
|---|---|
| Primair | Champagne vlak, donkere tekst. Eén per beeld: “Vraag beschikbaarheid”. |
| Secundair | Haarlijnrand, lichte tekst. “Bekijk het wagenpark”. |
| Tekstlink met pijl | Kaarten en verwijzingen. Pijl schuift 4 px bij hover. |
| WhatsApp | Secundaire vorm met WhatsApp-icoon; geen merkgroen. |

Minimale aanraakgrootte 48 × 48 px.

## Focus en hover

- Focus: 2 px champagne-outline met 3 px afstand, overal zichtbaar; op lichte ondergrond de diepe variant.
- Hover is altijd een versterking, nooit de enige plek van informatie. Touch krijgt dezelfde inhoud zonder hover.

## Motion

| Token | Waarde | Gebruik |
|---|---|---|
| `--d-fast` | 160 ms | Kleur, rand |
| `--d-base` | 280 ms | UI-staat, menu-items |
| `--d-slow` | 600 ms | Beeldzoom bij hover |
| `--d-reveal` | 900 ms | Scroll-reveals |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Binnenkomen (GSAP `expo.out`) |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Wisselen (GSAP `power3.inOut`) |

Principes: beweging maakt hiërarchie zichtbaar; alleen `transform` en `opacity`; geen permanente animaties buiten beeld; alles werkt zonder JavaScript en met `prefers-reduced-motion` (dan: geen parallax, geen pin, stilstaande marquee).

De hero-intro draait in CSS zodat hij op de eerste paint start en niet op JavaScript wacht (LCP). GSAP/ScrollTrigger verzorgt al het scrollgedrag: kopreveals, kaarten, parallax, de signature-sectie, header en marquee.

## Gedrag per schermformaat

| Formaat | Hero | Signature-sectie | Voertuigpagina |
|---|---|---|---|
| Mobiel (< 720 px) | Staand beeld schermvullend, tekst onderaan op verloop | Verticale hoofdstukken, geen pin | Swipe-galerij, CTA-balk onderaan (safe area) |
| Tablet (720–1079 px) | Staand beeld, tekst in kolom ernaast vanaf liggend | Verticale hoofdstukken | Galerij boven, informatie eronder |
| Desktop (≥ 1080 px) | Asymmetrisch: typografie links, staand beeldvlak rechts | Vastgezet beeld, wisselende modellen met voortgang | Sticky informatiekolom |
| Groot (≥ 1600 px) | Inhoud begrensd op 1440 px | idem | idem |
