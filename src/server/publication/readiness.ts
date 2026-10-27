/**
 * Publicatiecheck: wat moet de eigenaar bevestigen voordat de website live
 * gaat, en wat verdwijnt automatisch zolang het niet bevestigd is.
 *
 * Dezelfde berekening wordt gebruikt door de pagina én door de actie die de
 * site live zet, zodat een blokkade niet via een oud scherm te omzeilen is.
 */
import { asc, eq } from 'drizzle-orm'
import { SITE_CHECKS, type SiteContent } from '@/domain/content'
import type { VerificationField } from '../vehicles/service'
import { siteUrl } from '@/lib/site'
import { getSiteContent } from '../content/settings'
import { getDb } from '../db/client'
import { faqs, media, pages, vehicles, vehicleVerifications } from '../db/schema'
import type { DbExecutor } from '../db/types'
import { mailConfigured } from '../mail'

export type CheckItem = {
  id: string
  label: string
  detail: string
  ok: boolean
  href?: string
}

export type VehicleReadiness = {
  id: string
  name: string
  status: 'concept' | 'gepubliceerd' | 'gearchiveerd'
  confirmed: VerificationField[]
  publicPhotos: number
  /** Wat op de live site verborgen blijft zolang het niet bevestigd is. */
  hiddenWhenLive: string[]
}

export type Readiness = {
  content: SiteContent
  mode: 'concept' | 'live'
  indexable: boolean
  siteUrl: string | null
  /** Moeten allemaal in orde zijn voordat de site live kan. */
  blockers: CheckItem[]
  /** Geen blokkade, wel belangrijk om te weten. */
  warnings: CheckItem[]
  vehicles: VehicleReadiness[]
  conceptFaqs: number
  canGoLive: boolean
}

const HIDDEN_LABELS: Array<{ field: VerificationField; label: string }> = [
  { field: 'dagprijs', label: 'prijs vanaf' },
  { field: 'borg', label: 'borg' },
  { field: 'tariefregels', label: 'weekend- en weektarief en extra kosten in de prijsberekening' },
  { field: 'specificaties', label: 'specificaties (vermogen, koppel, acceleratie, transmissie, bouwjaar)' },
  { field: 'voorwaarden', label: 'minimumleeftijd, kilometerregeling en kentekenland' },
  { field: 'uitvoering', label: 'uitvoering en kenmerken' },
]

export async function publicationReadiness(db: DbExecutor = getDb()): Promise<Readiness> {
  const [content, vehicleRows, verificationRows, photoRows, pageRows, faqRows] = await Promise.all([
    getSiteContent(db),
    db.select({ id: vehicles.id, name: vehicles.name, status: vehicles.status }).from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.name)),
    db.select({ vehicleId: vehicleVerifications.vehicleId, field: vehicleVerifications.field }).from(vehicleVerifications),
    db.select({ vehicleId: media.vehicleId }).from(media).where(eq(media.isPublic, true)),
    db.select({ slug: pages.slug, status: pages.status }).from(pages),
    db.select({ status: faqs.status }).from(faqs),
  ])

  const list: VehicleReadiness[] = vehicleRows.map((v) => {
    const confirmed = verificationRows.filter((x) => x.vehicleId === v.id).map((x) => x.field as VerificationField)
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      confirmed,
      publicPhotos: photoRows.filter((p) => p.vehicleId === v.id).length,
      hiddenWhenLive: HIDDEN_LABELS.filter((h) => !confirmed.includes(h.field)).map((h) => h.label),
    }
  })
  const published = list.filter((v) => v.status === 'gepubliceerd')
  const url = siteUrl()
  const privacy = pageRows.find((p) => p.slug === 'privacy')
  const terms = pageRows.find((p) => p.slug === 'voorwaarden')

  const blockers: CheckItem[] = [
    {
      id: 'auto',
      label: 'Minstens één gepubliceerde auto',
      detail: published.length ? `${published.length} gepubliceerd` : 'Publiceer eerst een auto in Wagenpark.',
      ok: published.length > 0,
      href: '/beheer/wagenpark',
    },
    ...published.map((v) => ({
      id: `fotos-${v.id}`,
      label: `Fotorechten ${v.name}`,
      detail: v.confirmed.includes('fotos') ? 'Bevestigd' : 'Bevestig dat deze foto’s op de website mogen.',
      ok: v.confirmed.includes('fotos'),
      href: `/beheer/wagenpark/${v.id}?tab=brongegevens`,
    })),
    ...SITE_CHECKS.map((c) => ({
      id: `check-${c.key}`,
      label: c.label,
      detail: c.hint,
      ok: content.siteChecks[c.key].confirmed,
    })),
    {
      id: 'privacy',
      label: 'Privacyverklaring gepubliceerd',
      detail: 'Het aanvraagformulier verwerkt persoonsgegevens; de privacyverklaring moet compleet en online zijn.',
      ok: privacy?.status === 'gepubliceerd',
      href: '/beheer/inhoud?tab=paginas',
    },
  ]

  const warnings: CheckItem[] = [
    {
      id: 'domein',
      label: 'Domein ingesteld (SITE_URL)',
      detail: url ? url : 'Zonder SITE_URL zijn er geen canonieke adressen en sitemap, en kan de site niet vindbaar worden gemaakt.',
      ok: Boolean(url),
    },
    {
      id: 'mail',
      label: 'E-mailmelding bij nieuwe aanvragen',
      detail: mailConfigured() ? 'Ingesteld' : 'Niet ingesteld: nieuwe aanvragen zijn alleen zichtbaar in het beheer.',
      ok: mailConfigured(),
    },
    {
      id: 'tariefregels',
      label: 'Rekenregels bevestigd',
      detail: content.pricingRules.confirmed
        ? 'De website rekent een indicatie uit op basis van de bevestigde regels.'
        : 'Zonder bevestigde dagtelling en btw toont de website geen berekende totaalprijs.',
      ok: content.pricingRules.confirmed,
    },
    {
      id: 'voorwaarden',
      label: 'Huurvoorwaarden gepubliceerd',
      detail: terms?.status === 'gepubliceerd' ? 'Online' : 'Nog niet online: klanten ontvangen de voorwaarden bij de bevestiging.',
      ok: terms?.status === 'gepubliceerd',
      href: '/beheer/inhoud?tab=paginas',
    },
  ]

  return {
    content,
    mode: content.publication.mode,
    indexable: content.publication.mode === 'live' && content.publication.indexable,
    siteUrl: url,
    blockers,
    warnings,
    vehicles: list,
    conceptFaqs: faqRows.filter((f) => f.status !== 'gepubliceerd').length,
    canGoLive: blockers.every((b) => b.ok),
  }
}
