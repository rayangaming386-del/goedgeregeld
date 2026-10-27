/**
 * Bewerkbare website-inhoud: schema’s met lengtelimieten (zodat een wijziging
 * de layout niet breekt) en de standaardteksten van het concept.
 *
 * Alle teksten zijn origineel geschreven en bevatten alleen claims die uit het
 * bronmateriaal volgen of die het aanvraagproces van deze website beschrijven.
 */
import { z } from 'zod'

const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min, min > 0 ? `Vul minimaal ${min} tekens in.` : undefined)
    .max(max, `Gebruik maximaal ${max} tekens.`)

const optionalUuid = z.uuid().nullable()

export const heroSchema = z.object({
  eyebrow: text(48, 2),
  headline: text(48, 2),
  headlineAccent: text(36),
  intro: text(240, 20),
  primaryCta: text(32, 2),
  secondaryCta: text(32, 2),
  modelLabel: text(40),
  mediaId: optionalUuid,
  focalX: z.number().int().min(0).max(100),
  focalY: z.number().int().min(0).max(100),
})

export const marqueeSchema = z.object({
  items: z.array(text(32, 2)).min(2, 'Gebruik minimaal twee teksten.').max(8, 'Gebruik maximaal acht teksten.'),
})

export const fleetIntroSchema = z.object({
  eyebrow: text(40, 2),
  title: text(70, 2),
  intro: text(260),
})

export const signatureSchema = z.object({
  eyebrow: text(40, 2),
  title: text(60, 2),
  intro: text(220),
  chapters: z
    .array(
      z.object({
        vehicleId: z.uuid(),
        mediaId: optionalUuid,
        detailMediaId: optionalUuid,
        line: text(120),
      }),
    )
    .max(8),
})

export const processSchema = z.object({
  eyebrow: text(40, 2),
  title: text(60, 2),
  steps: z
    .array(z.object({ title: text(48, 2), body: text(220, 10) }))
    .min(3, 'Gebruik drie of vier stappen.')
    .max(4, 'Gebruik drie of vier stappen.'),
  note: text(200),
})

export const aboutSchema = z.object({
  eyebrow: text(40, 2),
  title: text(80, 2),
  body: text(900, 40),
  mediaId: optionalUuid,
  focalX: z.number().int().min(0).max(100),
  focalY: z.number().int().min(0).max(100),
})

export const faqIntroSchema = z.object({
  eyebrow: text(40, 2),
  title: text(60, 2),
  outro: text(200),
})

export const closingSchema = z.object({
  eyebrow: text(40, 2),
  title: text(70, 2),
  body: text(260),
  primaryCta: text(32, 2),
  whatsappCta: text(32, 2),
  mediaId: optionalUuid,
  focalX: z.number().int().min(0).max(100),
  focalY: z.number().int().min(0).max(100),
})

export const contactSchema = z.object({
  /** Internationaal, alleen cijfers: 31616161623 */
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Gebruik het internationale nummer zonder + of spaties, bijvoorbeeld 31612345678.'),
  phoneDisplay: text(24),
  instagramUrl: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(v), 'Gebruik een volledige Instagram-link.'),
  instagramHandle: text(40),
  city: text(40, 2),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Controleer het e-mailadres.'),
})

export const footerSchema = z.object({
  tagline: text(160),
  legalNote: text(260),
})

export const publicationSchema = z.object({
  mode: z.enum(['concept', 'live']),
  indexable: z.boolean(),
})

export const pricingRulesSchema = z.object({
  dayCounting: z.enum(['per_24_uur', 'per_kalenderdag']).nullable(),
  vat: z.enum(['onbekend', 'inclusief', 'exclusief']),
  confirmed: z.boolean(),
})

/** Controles op bedrijfsniveau die de eigenaar vóór livegang afvinkt. */
export const SITE_CHECKS = [
  {
    key: 'logo',
    label: 'Logo',
    hint: 'Het logo mag in deze vorm op de website staan. Een scherp vectorbestand (SVG of PDF) is aangevraagd of aangeleverd.',
  },
  {
    key: 'contact',
    label: 'Contactgegevens',
    hint: 'WhatsApp, telefoonnummer en Instagram zijn van Goed Geregeld zelf en niet van een tussenpersoon.',
  },
  {
    key: 'teksten',
    label: 'Teksten',
    hint: 'De teksten op de homepage en de autopagina’s zijn gelezen en kloppen.',
  },
] as const

export type SiteCheckKey = (typeof SITE_CHECKS)[number]['key']

const siteCheck = z.object({
  confirmed: z.boolean(),
  by: z.string().max(80).nullable(),
  at: z.iso.datetime().nullable(),
})

export const siteChecksSchema = z.object({ logo: siteCheck, contact: siteCheck, teksten: siteCheck })

export const SETTINGS = {
  hero: heroSchema,
  marquee: marqueeSchema,
  fleetIntro: fleetIntroSchema,
  signature: signatureSchema,
  process: processSchema,
  about: aboutSchema,
  faqIntro: faqIntroSchema,
  closing: closingSchema,
  contact: contactSchema,
  footer: footerSchema,
  publication: publicationSchema,
  pricingRules: pricingRulesSchema,
  siteChecks: siteChecksSchema,
} as const

export type SettingKey = keyof typeof SETTINGS
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>
export type SiteContent = { [K in SettingKey]: SettingValue<K> }

export const SETTING_LABELS: Record<SettingKey, string> = {
  hero: 'Hero',
  marquee: 'Tekstbalk',
  fleetIntro: 'Wagenpark-introductie',
  signature: 'Performance in detail',
  process: 'Hoe huren werkt',
  about: 'Over Goed Geregeld',
  faqIntro: 'Veelgestelde vragen',
  closing: 'Afsluitende oproep',
  contact: 'Contactgegevens',
  footer: 'Footer',
  publication: 'Publicatie',
  pricingRules: 'Tariefregels',
  siteChecks: 'Controles vóór livegang',
}

/** Standaardinhoud van het concept. Afbeeldingen worden door de seed gekoppeld. */
export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    eyebrow: 'Autoverhuur in Den Haag',
    headline: 'Sportieve Audi’s,',
    headlineAccent: 'goed geregeld.',
    intro:
      'Van de compacte RS3 tot de SQ8. Geef je gewenste periode door en je hoort persoonlijk wat er mogelijk is.',
    primaryCta: 'Bekijk het wagenpark',
    secondaryCta: 'Vraag beschikbaarheid',
    modelLabel: 'Audi RS3 Sportback',
    mediaId: null,
    focalX: 36,
    focalY: 58,
  },
  marquee: {
    items: ['Goed Geregeld', 'Audi performance', 'Den Haag', 'Ontdek het wagenpark'],
  },
  fleetIntro: {
    eyebrow: 'Wagenpark',
    title: 'Elk model een eigen karakter.',
    intro: 'Van compact en direct tot ruim en krachtig. Kies je auto en vraag de beschikbaarheid aan voor jouw periode.',
  },
  signature: {
    eyebrow: 'Performance in detail',
    title: 'Oplopend in vermogen.',
    intro: 'Elk model heeft een eigen lichtsignatuur, interieur en karakter. Scroll door het wagenpark.',
    chapters: [],
  },
  process: {
    eyebrow: 'Zo werkt huren',
    title: 'In vier stappen op weg.',
    steps: [
      { title: 'Kies je auto', body: 'Bekijk het wagenpark en kies de auto die bij je plannen past.' },
      {
        title: 'Geef je periode door',
        body: 'Vul je gewenste begin en einde in via het formulier of WhatsApp. Dat is nog geen reservering.',
      },
      {
        title: 'Ontvang bevestiging en voorwaarden',
        body: 'Je hoort of de auto vrij is en ontvangt de huurvoorwaarden. Pas na die bevestiging is de auto voor je gereserveerd.',
      },
      { title: 'Haal de auto op', body: 'Je haalt de auto op volgens de afspraak die we samen maken.' },
    ],
    note: 'Een aanvraag is vrijblijvend en nog geen definitieve reservering.',
  },
  about: {
    eyebrow: 'Over Goed Geregeld',
    title: 'Persoonlijk geregeld, vanuit Den Haag.',
    body:
      'Goed Geregeld verhuurt sportieve Audi’s vanuit Den Haag. Je aanvraag komt rechtstreeks bij ons binnen en je krijgt persoonlijk antwoord, vaak via WhatsApp.\n\nWe maken eerst duidelijke afspraken over je periode, de prijs en de voorwaarden. Daarna pas de sleutel.',
    mediaId: null,
    focalX: 50,
    focalY: 50,
  },
  faqIntro: {
    eyebrow: 'Veelgestelde vragen',
    title: 'Goed om te weten.',
    outro: 'Staat je vraag er niet bij? Stuur ons een bericht via WhatsApp.',
  },
  closing: {
    eyebrow: 'Contact',
    title: 'Zeg welke auto en wanneer.',
    body: 'Stuur je aanvraag via het formulier of WhatsApp. Je krijgt persoonlijk antwoord over de beschikbaarheid en de voorwaarden voor jouw periode.',
    primaryCta: 'Vraag beschikbaarheid',
    whatsappCta: 'Stuur een WhatsApp',
    mediaId: null,
    focalX: 52,
    focalY: 58,
  },
  contact: {
    whatsapp: '31616161623',
    phoneDisplay: '+31 6 16161623',
    instagramUrl: 'https://www.instagram.com/goed.geregeld/',
    instagramHandle: '@goed.geregeld',
    city: 'Den Haag',
    email: '',
  },
  footer: {
    tagline: 'Sportieve Audi’s huren in Den Haag.',
    legalNote: 'Audi en de genoemde modelnamen zijn merken van AUDI AG. Deze website is geen uitgave van Audi.',
  },
  publication: { mode: 'concept', indexable: false },
  pricingRules: { dayCounting: null, vat: 'onbekend', confirmed: false },
  siteChecks: {
    logo: { confirmed: false, by: null, at: null },
    contact: { confirmed: false, by: null, at: null },
    teksten: { confirmed: false, by: null, at: null },
  },
}

/* ───────────── Vaste onderwerpen voor veelgestelde vragen ───────────── */

export const FAQ_TOPICS = [
  { key: 'aanvraag', label: 'Aanvraag en reservering' },
  { key: 'beschikbaarheid', label: 'Beschikbaarheid' },
  { key: 'minimumleeftijd', label: 'Minimumleeftijd' },
  { key: 'borg', label: 'Borg' },
  { key: 'huurperiode', label: 'Huurperiode' },
  { key: 'kilometers', label: 'Kilometerregeling' },
  { key: 'ophalen', label: 'Ophalen en terugbrengen' },
  { key: 'buitenland', label: 'Buitenlandgebruik' },
  { key: 'verzekering', label: 'Verzekering en eigen risico' },
  { key: 'annulering', label: 'Annulering' },
  { key: 'overig', label: 'Overig' },
] as const

/** Een antwoord met een invulmarkering mag niet gepubliceerd worden. */
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]]*\]/.test(text) || text.trim().length === 0
}
