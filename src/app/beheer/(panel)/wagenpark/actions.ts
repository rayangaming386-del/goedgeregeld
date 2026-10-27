'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { can } from '@/domain/permissions'
import { parseEuroToCents } from '@/lib/format'
import { isValidSlug } from '@/lib/slug'
import { recordAudit } from '@/server/audit'
import { actionUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { media, revisions, vehicles, type ExtraCost } from '@/server/db/schema'
import { ImageValidationError, MAX_UPLOAD_BYTES } from '@/server/media/pipeline'
import { deleteImage, removeFiles, reorderImages, replaceImage, storeImage } from '@/server/media/service'
import {
  createVehicle,
  deleteVehicle,
  moveVehicle,
  restoreRevision,
  setFeatured,
  setStatus,
  setVerification,
  updateGeneral,
  updatePricing,
  updateSeo,
  updateSpecs,
  VehicleError,
  type VerificationField,
} from '@/server/vehicles/service'

const NO_ACCESS = 'Je hebt geen rechten voor deze actie.'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

function refresh(id?: string) {
  revalidatePath('/beheer', 'layout')
  // De publieke site toont wijzigingen direct na opslaan.
  revalidatePath('/', 'layout')
  if (id) revalidatePath(`/beheer/wagenpark/${id}`)
}

async function handle(err: unknown): Promise<ActionState> {
  if (err instanceof VehicleError || err instanceof ImageValidationError) return fail(err.message)
  console.error('[wagenpark] actie mislukt:', err instanceof Error ? err.name : 'onbekend')
  return fail('Er ging iets mis bij het opslaan. Probeer het opnieuw.')
}

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), `${label} moet een heel getal tussen ${min} en ${max} zijn.`)

/* ───────────── Aanmaken ───────────── */

const createSchema = z.object({
  brand: z.string().trim().min(2, 'Vul een merk in.').max(40),
  model: z.string().trim().min(1, 'Vul een model in.').max(60),
  name: z.string().trim().min(2, 'Vul een naam in.').max(80),
})

export async function createVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const parsed = createSchema.safeParse({ brand: str(fd, 'brand') || 'Audi', model: str(fd, 'model'), name: str(fd, 'name') })
  if (!parsed.success) return fail('Controleer de velden.', zodErrors(parsed.error))
  let id: string
  try {
    id = (await createVehicle(parsed.data, user)).id
  } catch (err) {
    return handle(err)
  }
  refresh()
  redirect(`/beheer/wagenpark/${id}?aangemaakt=1`)
}

/* ───────────── Algemeen ───────────── */

const generalSchema = z.object({
  name: z.string().trim().min(2, 'Vul een naam in.').max(80, 'Maximaal 80 tekens.'),
  brand: z.string().trim().min(2).max(40, 'Maximaal 40 tekens.'),
  model: z.string().trim().min(1, 'Vul een model in.').max(60, 'Maximaal 60 tekens.'),
  edition: z.string().trim().max(60, 'Maximaal 60 tekens.'),
  tagline: z.string().trim().max(90, 'Maximaal 90 tekens; dit past op een kaart.'),
  description: z.string().trim().max(1200, 'Maximaal 1200 tekens.'),
  highlights: z.array(z.string().trim().min(2).max(80, 'Een kenmerk is maximaal 80 tekens.')).max(8, 'Maximaal 8 kenmerken.'),
})

export async function updateGeneralAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  const parsed = generalSchema.safeParse({
    name: str(fd, 'name'),
    brand: str(fd, 'brand'),
    model: str(fd, 'model'),
    edition: str(fd, 'edition'),
    tagline: str(fd, 'tagline'),
    description: String(fd.get('description') ?? '').replace(/\r\n/g, '\n').trim(),
    highlights: String(fd.get('highlights') ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  })
  if (!parsed.success) return fail('Controleer de velden.', zodErrors(parsed.error))
  const confirm = fd.get('confirm') === 'on' && can(user.role, 'brongegevens:bevestigen')
  try {
    const [current] = await getDb().select({ featured: vehicles.featured }).from(vehicles).where(eq(vehicles.id, id))
    await updateGeneral(id, { ...parsed.data, edition: parsed.data.edition || null, featured: current?.featured ?? false }, { actor: user, confirm })
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done('Algemene gegevens opgeslagen.')
}

/* ───────────── Specificaties en voorwaarden ───────────── */

const specsSchema = z.object({
  powerHp: optionalInt(1, 2000, 'Vermogen'),
  torqueNm: optionalInt(1, 3000, 'Koppel'),
  accel: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Math.round(Number(v.replace(',', '.')) * 10)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 15 && v <= 300), '0–100 km/u tussen 1,5 en 30 seconden.'),
  transmission: z.string().trim().max(40),
  modelYear: optionalInt(1990, 2100, 'Bouwjaar'),
  minAge: optionalInt(16, 99, 'Minimumleeftijd'),
  mileagePolicy: z.string().trim().max(80),
  plateCountry: z.string().trim().max(40),
})

export async function updateSpecsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  const parsed = specsSchema.safeParse(Object.fromEntries(['powerHp', 'torqueNm', 'accel', 'transmission', 'modelYear', 'minAge', 'mileagePolicy', 'plateCountry'].map((k) => [k, str(fd, k)])))
  if (!parsed.success) return fail('Controleer de velden.', zodErrors(parsed.error))
  const mayConfirm = can(user.role, 'brongegevens:bevestigen')
  try {
    await updateSpecs(
      id,
      {
        powerHp: parsed.data.powerHp,
        torqueNm: parsed.data.torqueNm,
        accelTenths: parsed.data.accel,
        transmission: parsed.data.transmission || null,
        modelYear: parsed.data.modelYear,
        minAge: parsed.data.minAge,
        mileagePolicy: parsed.data.mileagePolicy || null,
        plateCountry: parsed.data.plateCountry || null,
      },
      { actor: user, confirmSpecs: mayConfirm && fd.get('confirmSpecs') === 'on', confirmTerms: mayConfirm && fd.get('confirmTerms') === 'on' },
    )
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done('Specificaties en voorwaarden opgeslagen.')
}

/* ───────────── Prijzen ───────────── */

export async function updatePricingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('prijzen:beheren')
  if (!user) return fail('Alleen de eigenaar kan prijzen wijzigen.')
  const id = str(fd, 'vehicleId')
  const errors: Record<string, string> = {}
  const money = (key: string, label: string, required = false) => {
    const raw = str(fd, key)
    if (!raw) {
      if (required) errors[key] = `Vul een ${label} in of laat de auto op “prijs op aanvraag”.`
      return null
    }
    const cents = parseEuroToCents(raw)
    if (cents === null || cents < 0 || cents > 10_000_000) errors[key] = `Controleer de ${label}.`
    return cents
  }
  const dayRateCents = money('dayRate', 'dagprijs')
  const weekendRateCents = money('weekendRate', 'weekendprijs')
  const weekRateCents = money('weekRate', 'weekprijs')
  const depositCents = money('deposit', 'borg')
  const extraCosts: ExtraCost[] = []
  const labels = fd.getAll('extraLabel').map(String)
  const amounts = fd.getAll('extraAmount').map(String)
  const units = fd.getAll('extraUnit').map(String)
  labels.forEach((label, i) => {
    const l = label.trim()
    const amountRaw = (amounts[i] ?? '').trim()
    if (!l && !amountRaw) return
    const cents = parseEuroToCents(amountRaw)
    if (!l || l.length > 60 || cents === null) {
      errors.extraCosts = 'Elke aanvullende kost heeft een omschrijving (max. 60 tekens) en een bedrag.'
      return
    }
    extraCosts.push({ id: `k${i}`, label: l, amountCents: cents, unit: units[i] === 'per_dag' ? 'per_dag' : 'per_huur' })
  })
  if (weekendRateCents !== null && dayRateCents === null) errors.weekendRate = 'Een weekendtarief kan alleen naast een dagprijs.'
  if (weekRateCents !== null && dayRateCents === null) errors.weekRate = 'Een weektarief kan alleen naast een dagprijs.'
  if (Object.keys(errors).length) return fail('Controleer de prijzen.', errors)
  try {
    await updatePricing(
      id,
      { dayRateCents, weekendRateCents, weekRateCents, depositCents, extraCosts },
      { actor: user, confirmDay: fd.get('confirmDay') === 'on', confirmDeposit: fd.get('confirmDeposit') === 'on', confirmRules: fd.get('confirmRules') === 'on' },
    )
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done('Prijzen opgeslagen.')
}

/* ───────────── URL en SEO ───────────── */

const seoSchema = z.object({
  slug: z.string().trim().refine(isValidSlug, 'Gebruik kleine letters, cijfers en koppeltekens (bijv. audi-rs3-sportback).'),
  seoTitle: z.string().trim().max(70, 'Een SEO-titel is maximaal 70 tekens.'),
  seoDescription: z.string().trim().max(160, 'Een omschrijving is maximaal 160 tekens.'),
})

export async function updateSeoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  const parsed = seoSchema.safeParse({ slug: str(fd, 'slug'), seoTitle: str(fd, 'seoTitle'), seoDescription: str(fd, 'seoDescription') })
  if (!parsed.success) return fail('Controleer de velden.', zodErrors(parsed.error))
  try {
    await updateSeo(id, { slug: parsed.data.slug, seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null }, user)
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done('URL en zoekmachinegegevens opgeslagen.')
}

/* ───────────── Status, volgorde, uitgelicht ───────────── */

export async function setStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, 'status')
  const id = str(fd, 'vehicleId')
  if (status !== 'concept' && status !== 'gepubliceerd' && status !== 'gearchiveerd') return fail('Onbekende status.')
  const user = await actionUser(status === 'gearchiveerd' ? 'wagenpark:archiveren' : 'wagenpark:publiceren')
  if (!user) return fail(NO_ACCESS)
  try {
    await setStatus(id, status, user)
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done(status === 'gepubliceerd' ? 'De auto staat op de website.' : status === 'gearchiveerd' ? 'De auto is gearchiveerd; de historie blijft bewaard.' : 'De auto is offline gehaald en staat weer in concept.')
}

export async function deleteVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:archiveren')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  try {
    const photos = await deleteVehicle(id, user)
    for (const p of photos) await removeFiles(p)
  } catch (err) {
    return handle(err)
  }
  refresh()
  redirect('/beheer/wagenpark?verwijderd=1')
}

export async function moveVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const direction = str(fd, 'richting') === 'omlaag' ? 'omlaag' : 'omhoog'
  await moveVehicle(str(fd, 'vehicleId'), direction, user)
  refresh()
  return done('Volgorde aangepast.')
}

export async function setFeaturedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  await setFeatured(id, str(fd, 'featured') === 'ja', user)
  refresh(id)
  return done('Opgeslagen.')
}

/* ───────────── Brongegevens bevestigen ───────────── */

const FIELDS: VerificationField[] = ['dagprijs', 'borg', 'tariefregels', 'specificaties', 'voorwaarden', 'uitvoering', 'fotos']

export async function setVerificationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('brongegevens:bevestigen')
  if (!user) return fail('Alleen de eigenaar kan gegevens bevestigen.')
  const id = str(fd, 'vehicleId')
  const [field, value] = str(fd, 'veld').split(':') as [VerificationField, string]
  if (!FIELDS.includes(field)) return fail('Onbekend gegeven.')
  await setVerification(id, field, value === 'ja', user)
  refresh(id)
  return done(value === 'ja' ? 'Bevestigd.' : 'Bevestiging ingetrokken.')
}

/* ───────────── Revisies ───────────── */

export async function restoreRevisionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('wagenpark:bewerken')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  const [rev] = await getDb().select().from(revisions).where(eq(revisions.id, str(fd, 'revisionId')))
  if (!rev || rev.entityType !== 'auto' || rev.entityId !== id) return fail('Versie niet gevonden.')
  const snap = { ...(rev.snapshot as Record<string, unknown>) }
  if (!can(user.role, 'prijzen:beheren')) {
    for (const f of ['dayRateCents', 'weekendRateCents', 'weekRateCents', 'depositCents', 'extraCosts']) delete snap[f]
  }
  try {
    await restoreRevision(id, snap, user)
  } catch (err) {
    return handle(err)
  }
  refresh(id)
  return done('Eerdere versie hersteld. Herstelde gegevens moeten opnieuw bevestigd worden.')
}

/* ───────────── Foto’s ───────────── */

export async function uploadPhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('media:beheren')
  if (!user) return fail(NO_ACCESS)
  const id = str(fd, 'vehicleId')
  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) return fail('Kies een afbeelding.')
  if (file.size > MAX_UPLOAD_BYTES) return fail(`${file.name}: groter dan 12 MB.`)
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const row = await storeImage(getDb(), { buffer, originalName: file.name, vehicleId: id, actorId: user.id, alt: '', isPublic: true })
    const [v] = await getDb().select({ primary: vehicles.primaryMediaId, name: vehicles.name }).from(vehicles).where(eq(vehicles.id, id))
    if (v && !v.primary) await getDb().update(vehicles).set({ primaryMediaId: row.id }).where(eq(vehicles.id, id))
    await recordAudit(getDb(), { actorId: user.id, action: 'foto.toegevoegd', entityType: 'foto', entityId: row.id, summary: `Foto toegevoegd aan ${v?.name ?? 'auto'}: ${file.name}` })
  } catch (err) {
    if (err instanceof ImageValidationError) return fail(`${file.name}: ${err.message}`)
    return handle(err)
  }
  refresh(id)
  return done(`${file.name} is toegevoegd. Vul nog een alt-tekst in.`)
}

const photoSchema = z.object({
  alt: z.string().trim().max(200, 'Een alt-tekst is maximaal 200 tekens.'),
  focalX: z.coerce.number().int().min(0).max(100),
  focalY: z.coerce.number().int().min(0).max(100),
})

export async function updatePhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('media:beheren')
  if (!user) return fail(NO_ACCESS)
  const mediaId = str(fd, 'mediaId')
  const parsed = photoSchema.safeParse({ alt: str(fd, 'alt'), focalX: str(fd, 'focalX') || 50, focalY: str(fd, 'focalY') || 50 })
  if (!parsed.success) return fail('Controleer de velden.', zodErrors(parsed.error))
  const isPublic = fd.get('isPublic') === 'on'
  if (isPublic && !parsed.data.alt) return fail('Vul een alt-tekst in voordat de foto publiek wordt.', { alt: 'Beschrijf wat er op de foto te zien is.' })
  const [row] = await getDb().select().from(media).where(eq(media.id, mediaId))
  if (!row) return fail('Foto niet gevonden.')
  await getDb().update(media).set({ ...parsed.data, isPublic, updatedAt: new Date() }).where(eq(media.id, mediaId))
  await recordAudit(getDb(), {
    actorId: user.id,
    action: 'foto.bijgewerkt',
    entityType: 'foto',
    entityId: mediaId,
    summary: `Foto bijgewerkt${row.isPublic !== isPublic ? (isPublic ? ' (nu publiek)' : ' (niet meer publiek)') : ''}`,
  })
  refresh(row.vehicleId ?? undefined)
  return done('Foto opgeslagen.')
}

export async function photoCommandAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('media:beheren')
  if (!user) return fail(NO_ACCESS)
  const db = getDb()
  const [command, mediaId] = str(fd, 'command').split(':')
  const [row] = await db.select().from(media).where(eq(media.id, mediaId ?? ''))
  if (!row || !row.vehicleId) return fail('Foto niet gevonden.')
  const vehicleId = row.vehicleId
  if (command === 'hoofdfoto') {
    if (!row.isPublic) return fail('Maak de foto eerst publiek voordat je hem als hoofdfoto kiest.')
    await db.update(vehicles).set({ primaryMediaId: row.id, updatedAt: new Date() }).where(eq(vehicles.id, vehicleId))
    await recordAudit(db, { actorId: user.id, action: 'foto.hoofdfoto', entityType: 'foto', entityId: row.id, summary: 'Hoofdfoto gewijzigd' })
  } else if (command === 'omhoog' || command === 'omlaag') {
    const all = await db.select({ id: media.id }).from(media).where(eq(media.vehicleId, vehicleId)).orderBy(media.sortOrder)
    const ids = all.map((a) => a.id)
    const i = ids.indexOf(row.id)
    const j = command === 'omhoog' ? i - 1 : i + 1
    if (j >= 0 && j < ids.length) {
      ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
      await reorderImages(db, vehicleId, ids)
    }
  } else if (command === 'verwijderen') {
    await deleteImage(db, row.id, user.id)
  } else {
    return fail('Onbekende opdracht.')
  }
  refresh(vehicleId)
  return done(command === 'verwijderen' ? 'Foto verwijderd.' : 'Opgeslagen.')
}

export async function reorderPhotosAction(vehicleId: string, orderedIds: string[]): Promise<ActionState> {
  const user = await actionUser('media:beheren')
  if (!user) return fail(NO_ACCESS)
  await reorderImages(getDb(), vehicleId, orderedIds)
  await recordAudit(getDb(), { actorId: user.id, action: 'foto.volgorde', entityType: 'auto', entityId: vehicleId, summary: 'Volgorde van foto’s gewijzigd' })
  refresh(vehicleId)
  return done('Volgorde opgeslagen.')
}

export async function replacePhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('media:beheren')
  if (!user) return fail(NO_ACCESS)
  const mediaId = str(fd, 'mediaId')
  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) return fail('Kies een afbeelding.')
  if (file.size > MAX_UPLOAD_BYTES) return fail('Het bestand is groter dan 12 MB.')
  const [row] = await getDb().select({ vehicleId: media.vehicleId }).from(media).where(eq(media.id, mediaId))
  try {
    await replaceImage(getDb(), mediaId, Buffer.from(await file.arrayBuffer()), file.name, user.id)
  } catch (err) {
    return handle(err)
  }
  refresh(row?.vehicleId ?? undefined)
  return done('Foto vervangen.')
}
