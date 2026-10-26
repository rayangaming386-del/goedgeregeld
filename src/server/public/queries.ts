/**
 * Publieke datalaag. Selecteert uitsluitend velden die op de website mogen
 * verschijnen: geen interne notities, bronnotities, fotonotities of
 * gebruikersgegevens. Onbevestigde gegevens worden in live-modus weggelaten.
 */
import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { cache } from 'react'
import type { SiteContent } from '@/domain/content'
import {
  publicDayPrice,
  publicDeposit,
  type PricingRules,
  type PromotionRule,
  type RateCard,
  type PublicDayPrice,
  type PublicDeposit,
  type PublicationMode,
} from '@/domain/pricing'
import { getSiteContent } from '../content/settings'
import { getDb } from '../db/client'
import { faqs, media, pages, promotions, promotionVehicles, vehicles, vehicleVerifications } from '../db/schema'
import { toPublicImage, type PublicImage } from './images'

export type VerificationField = 'dagprijs' | 'borg' | 'tariefregels' | 'specificaties' | 'voorwaarden' | 'uitvoering' | 'fotos'

export type PublicContext = {
  content: SiteContent
  mode: PublicationMode
  rules: PricingRules
  indexable: boolean
  now: Date
}

export const getPublicContext = cache(async (): Promise<PublicContext> => {
  const content = await getSiteContent()
  return {
    content,
    mode: content.publication.mode,
    indexable: content.publication.mode === 'live' && content.publication.indexable,
    rules: content.pricingRules,
    now: new Date(),
  }
})

export type PublicVehicle = {
  id: string
  slug: string
  name: string
  brand: string
  model: string
  code: string
  edition: string | null
  tagline: string
  paragraphs: string[]
  featured: boolean
  highlights: string[] | null
  highlightsConfirmed: boolean
  specs: {
    powerHp: number | null
    torqueNm: number | null
    accelTenths: number | null
    transmission: string | null
    modelYear: number | null
  } | null
  specsConfirmed: boolean
  terms: { minAge: number | null; mileagePolicy: string | null; plateCountry: string | null } | null
  termsConfirmed: boolean
  price: PublicDayPrice
  deposit: PublicDeposit
  image: PublicImage | null
  images: PublicImage[]
  seo: { title: string; description: string }
  updatedAt: Date
}

/** “RS3 Sportback” → “RS3”, “RS Q3” → “RS Q3”. */
export function modelCode(model: string): string {
  return model.replace(/\s*Sportback$/i, '').trim()
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

async function loadVehicles(where: 'all' | { slug: string }, ctx: PublicContext): Promise<PublicVehicle[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      name: vehicles.name,
      brand: vehicles.brand,
      model: vehicles.model,
      edition: vehicles.edition,
      tagline: vehicles.tagline,
      description: vehicles.description,
      highlights: vehicles.highlights,
      featured: vehicles.featured,
      powerHp: vehicles.powerHp,
      torqueNm: vehicles.torqueNm,
      accelTenths: vehicles.accelTenths,
      transmission: vehicles.transmission,
      modelYear: vehicles.modelYear,
      minAge: vehicles.minAge,
      mileagePolicy: vehicles.mileagePolicy,
      plateCountry: vehicles.plateCountry,
      dayRateCents: vehicles.dayRateCents,
      depositCents: vehicles.depositCents,
      primaryMediaId: vehicles.primaryMediaId,
      seoTitle: vehicles.seoTitle,
      seoDescription: vehicles.seoDescription,
      updatedAt: vehicles.updatedAt,
    })
    .from(vehicles)
    .where(
      where === 'all'
        ? eq(vehicles.status, 'gepubliceerd')
        : and(eq(vehicles.status, 'gepubliceerd'), eq(vehicles.slug, where.slug)),
    )
    .orderBy(asc(vehicles.sortOrder), asc(vehicles.name))
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [photoRows, verificationRows, promoRows] = await Promise.all([
    db
      .select({
        id: media.id,
        vehicleId: media.vehicleId,
        alt: media.alt,
        width: media.width,
        height: media.height,
        focalX: media.focalX,
        focalY: media.focalY,
        placeholder: media.placeholder,
        variants: media.variants,
      })
      .from(media)
      .where(and(inArray(media.vehicleId, ids), eq(media.isPublic, true)))
      .orderBy(asc(media.sortOrder)),
    db
      .select({ vehicleId: vehicleVerifications.vehicleId, field: vehicleVerifications.field })
      .from(vehicleVerifications)
      .where(inArray(vehicleVerifications.vehicleId, ids)),
    db
      .select({
        vehicleId: promotionVehicles.vehicleId,
        id: promotions.id,
        title: promotions.title,
        kind: promotions.kind,
        value: promotions.value,
        startsAt: promotions.startsAt,
        endsAt: promotions.endsAt,
      })
      .from(promotions)
      .innerJoin(promotionVehicles, eq(promotionVehicles.promotionId, promotions.id))
      .where(and(eq(promotions.status, 'gepubliceerd'), gt(promotions.endsAt, ctx.now), inArray(promotionVehicles.vehicleId, ids))),
  ])

  const live = ctx.mode === 'live'
  return rows.map((r) => {
    const confirmed = new Set(verificationRows.filter((v) => v.vehicleId === r.id).map((v) => v.field as VerificationField))
    const photos = photoRows.filter((p) => p.vehicleId === r.id)
    const primary = photos.find((p) => p.id === r.primaryMediaId) ?? photos[0] ?? null
    const ordered = primary ? [primary, ...photos.filter((p) => p.id !== primary.id)] : photos
    const promos: PromotionRule[] = promoRows
      .filter((p) => p.vehicleId === r.id)
      .map((p) => ({ id: p.id, title: p.title, kind: p.kind, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt }))

    const specsConfirmed = confirmed.has('specificaties')
    const termsConfirmed = confirmed.has('voorwaarden')
    const highlightsConfirmed = confirmed.has('uitvoering')

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      brand: r.brand,
      model: r.model,
      code: modelCode(r.model),
      edition: r.edition,
      tagline: r.tagline,
      paragraphs: paragraphs(r.description),
      featured: r.featured,
      highlights: live && !highlightsConfirmed ? null : r.highlights,
      highlightsConfirmed,
      specs:
        live && !specsConfirmed
          ? null
          : {
              powerHp: r.powerHp,
              torqueNm: r.torqueNm,
              accelTenths: r.accelTenths,
              transmission: r.transmission,
              modelYear: r.modelYear,
            },
      specsConfirmed,
      terms: live && !termsConfirmed ? null : { minAge: r.minAge, mileagePolicy: r.mileagePolicy, plateCountry: r.plateCountry },
      termsConfirmed,
      price: publicDayPrice({
        rate: { dayRateCents: r.dayRateCents },
        confirmed: confirmed.has('dagprijs'),
        rules: ctx.rules,
        promotions: promos,
        mode: ctx.mode,
        now: ctx.now,
      }),
      deposit: publicDeposit({ depositCents: r.depositCents, confirmed: confirmed.has('borg'), mode: ctx.mode }),
      image: primary ? toPublicImage(primary) : null,
      images: ordered.map(toPublicImage),
      seo: {
        title: r.seoTitle || `${r.name} huren in Den Haag`,
        description: r.seoDescription || r.tagline,
      },
      updatedAt: r.updatedAt,
    }
  })
}

export const getPublishedVehicles = cache(async (): Promise<PublicVehicle[]> => {
  const ctx = await getPublicContext()
  return loadVehicles('all', ctx)
})

export const getPublishedVehicle = cache(async (slug: string): Promise<PublicVehicle | null> => {
  const ctx = await getPublicContext()
  const [v] = await loadVehicles({ slug }, ctx)
  return v ?? null
})

export const getPublicImages = cache(async (ids: Array<string | null | undefined>): Promise<Map<string, PublicImage>> => {
  const wanted = ids.filter((id): id is string => Boolean(id))
  if (wanted.length === 0) return new Map()
  const rows = await getDb()
    .select({
      id: media.id,
      alt: media.alt,
      width: media.width,
      height: media.height,
      focalX: media.focalX,
      focalY: media.focalY,
      placeholder: media.placeholder,
      variants: media.variants,
    })
    .from(media)
    .where(and(inArray(media.id, wanted), eq(media.isPublic, true)))
  return new Map(rows.map((r) => [r.id, toPublicImage(r)]))
})

export type PublicFaq = { id: string; question: string; answer: string[] }

export const getPublishedFaqs = cache(async (): Promise<PublicFaq[]> => {
  const rows = await getDb()
    .select({ id: faqs.id, question: faqs.question, answer: faqs.answer })
    .from(faqs)
    .where(eq(faqs.status, 'gepubliceerd'))
    .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt))
  return rows.map((r) => ({ id: r.id, question: r.question, answer: paragraphs(r.answer) }))
})

export type PublicPage = { slug: string; title: string; body: string; updatedAt: Date }

export const getPublishedPage = cache(async (slug: string): Promise<PublicPage | null> => {
  const [row] = await getDb()
    .select({ slug: pages.slug, title: pages.title, body: pages.body, updatedAt: pages.updatedAt })
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.status, 'gepubliceerd')))
  return row ?? null
})

export const getPublishedPageSlugs = cache(async (): Promise<string[]> => {
  const rows = await getDb().select({ slug: pages.slug }).from(pages).where(eq(pages.status, 'gepubliceerd'))
  return rows.map((r) => r.slug)
})

/**
 * Invoer voor een prijsberekening in het aanvraagformulier. Alleen beschikbaar
 * als de tariefregels én de dagprijs van de auto door de eigenaar zijn bevestigd;
 * weekend- en weektarief en aanvullende kosten alleen als ook die bevestigd zijn.
 */
export const getQuoteInputs = cache(async (): Promise<Map<string, { rate: RateCard; promotions: PromotionRule[] }>> => {
  const ctx = await getPublicContext()
  const result = new Map<string, { rate: RateCard; promotions: PromotionRule[] }>()
  if (!ctx.rules.confirmed || !ctx.rules.dayCounting) return result
  const db = getDb()
  const rows = await db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      dayRateCents: vehicles.dayRateCents,
      weekendRateCents: vehicles.weekendRateCents,
      weekRateCents: vehicles.weekRateCents,
      depositCents: vehicles.depositCents,
      extraCosts: vehicles.extraCosts,
    })
    .from(vehicles)
    .where(eq(vehicles.status, 'gepubliceerd'))
  if (!rows.length) return result
  const ids = rows.map((r) => r.id)
  const [ver, promos] = await Promise.all([
    db.select({ vehicleId: vehicleVerifications.vehicleId, field: vehicleVerifications.field }).from(vehicleVerifications).where(inArray(vehicleVerifications.vehicleId, ids)),
    db
      .select({
        vehicleId: promotionVehicles.vehicleId,
        id: promotions.id,
        title: promotions.title,
        kind: promotions.kind,
        value: promotions.value,
        startsAt: promotions.startsAt,
        endsAt: promotions.endsAt,
      })
      .from(promotions)
      .innerJoin(promotionVehicles, eq(promotionVehicles.promotionId, promotions.id))
      .where(and(eq(promotions.status, 'gepubliceerd'), gt(promotions.endsAt, ctx.now), inArray(promotionVehicles.vehicleId, ids))),
  ])
  for (const r of rows) {
    const confirmed = new Set(ver.filter((v) => v.vehicleId === r.id).map((v) => v.field))
    if (!confirmed.has('dagprijs') || r.dayRateCents === null) continue
    const rulesOk = confirmed.has('tariefregels')
    result.set(r.slug, {
      rate: {
        dayRateCents: r.dayRateCents,
        weekendRateCents: rulesOk ? r.weekendRateCents : null,
        weekRateCents: rulesOk ? r.weekRateCents : null,
        depositCents: confirmed.has('borg') ? r.depositCents : null,
        extraCosts: rulesOk ? r.extraCosts : [],
      },
      promotions: promos
        .filter((p) => p.vehicleId === r.id)
        .map((p) => ({ id: p.id, title: p.title, kind: p.kind, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt })),
    })
  }
  return result
})
