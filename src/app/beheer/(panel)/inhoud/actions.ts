'use server'

import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { FAQ_TOPICS, hasPlaceholder, SETTING_LABELS, SETTINGS, type SettingKey } from '@/domain/content'
import { recordAudit, recordRevision } from '@/server/audit'
import { actionUser } from '@/server/auth/session'
import { getSetting, saveSetting } from '@/server/content/settings'
import { getDb } from '@/server/db/client'
import { faqs, pages, revisions } from '@/server/db/schema'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : ''
}

function num(fd: FormData, key: string, fallback = 50): number {
  const n = Number(str(fd, key))
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function refresh() {
  revalidatePath('/beheer', 'layout')
  revalidatePath('/', 'layout')
}

const EDITABLE: SettingKey[] = ['hero', 'marquee', 'fleetIntro', 'signature', 'process', 'about', 'faqIntro', 'closing', 'contact', 'footer']

/** Zet formuliervelden om naar de vorm van de instelling. */
async function readSetting(key: SettingKey, fd: FormData): Promise<unknown> {
  switch (key) {
    case 'hero':
      return {
        eyebrow: str(fd, 'eyebrow'),
        headline: str(fd, 'headline'),
        headlineAccent: str(fd, 'headlineAccent'),
        intro: str(fd, 'intro'),
        primaryCta: str(fd, 'primaryCta'),
        secondaryCta: str(fd, 'secondaryCta'),
        modelLabel: str(fd, 'modelLabel'),
        mediaId: str(fd, 'mediaId') || null,
        focalX: num(fd, 'focalX'),
        focalY: num(fd, 'focalY'),
      }
    case 'marquee':
      return { items: str(fd, 'items').split('\n').map((s) => s.trim()).filter(Boolean) }
    case 'fleetIntro':
    case 'faqIntro':
      return key === 'fleetIntro'
        ? { eyebrow: str(fd, 'eyebrow'), title: str(fd, 'title'), intro: str(fd, 'intro') }
        : { eyebrow: str(fd, 'eyebrow'), title: str(fd, 'title'), outro: str(fd, 'outro') }
    case 'signature': {
      const current = await getSetting('signature')
      return {
        eyebrow: str(fd, 'eyebrow'),
        title: str(fd, 'title'),
        intro: str(fd, 'intro'),
        chapters: current.chapters.map((c, i) => ({
          ...c,
          line: str(fd, `line-${i}`),
          mediaId: str(fd, `media-${i}`) || null,
          detailMediaId: str(fd, `detail-${i}`) || null,
        })),
      }
    }
    case 'process':
      return {
        eyebrow: str(fd, 'eyebrow'),
        title: str(fd, 'title'),
        note: str(fd, 'note'),
        steps: [0, 1, 2, 3]
          .map((i) => ({ title: str(fd, `step-title-${i}`), body: str(fd, `step-body-${i}`) }))
          .filter((s) => s.title || s.body),
      }
    case 'about':
      return { eyebrow: str(fd, 'eyebrow'), title: str(fd, 'title'), body: str(fd, 'body'), mediaId: str(fd, 'mediaId') || null, focalX: num(fd, 'focalX'), focalY: num(fd, 'focalY') }
    case 'closing':
      return {
        eyebrow: str(fd, 'eyebrow'),
        title: str(fd, 'title'),
        body: str(fd, 'body'),
        primaryCta: str(fd, 'primaryCta'),
        whatsappCta: str(fd, 'whatsappCta'),
        mediaId: str(fd, 'mediaId') || null,
        focalX: num(fd, 'focalX'),
        focalY: num(fd, 'focalY'),
      }
    case 'contact':
      return {
        whatsapp: str(fd, 'whatsapp').replace(/\D/g, ''),
        phoneDisplay: str(fd, 'phoneDisplay'),
        instagramUrl: str(fd, 'instagramUrl'),
        instagramHandle: str(fd, 'instagramHandle'),
        city: str(fd, 'city'),
        email: str(fd, 'email'),
      }
    case 'footer':
      return { tagline: str(fd, 'tagline'), legalNote: str(fd, 'legalNote') }
    default:
      return null
  }
}

export async function saveSettingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const key = str(fd, 'key') as SettingKey
  if (!EDITABLE.includes(key)) return fail('Onbekend onderdeel.')
  // Contactgegevens zijn bedrijfsgegevens: alleen de eigenaar.
  const user = await actionUser(key === 'contact' ? 'instellingen:beheren' : 'inhoud:beheren')
  if (!user) return fail('Je hebt geen rechten om dit onderdeel te wijzigen.')
  const raw = await readSetting(key, fd)
  const parsed = SETTINGS[key].safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('-')
      const field = path.startsWith('steps-') ? `step-${path.split('-')[2] === 'body' ? 'body' : 'title'}-${path.split('-')[1]}` : path.startsWith('chapters-') ? `line-${path.split('-')[1]}` : String(issue.path[0] ?? 'form')
      errors[field] ??= issue.message
    }
    return fail('Niet opgeslagen: controleer de gemarkeerde velden.', errors)
  }
  await saveSetting(getDb(), key, parsed.data as never, user.id, `${SETTING_LABELS[key]} bijgewerkt`)
  refresh()
  return done(`${SETTING_LABELS[key]} opgeslagen en direct zichtbaar op de website.`)
}

export async function restoreSettingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('inhoud:beheren')
  if (!user) return fail('Je hebt geen rechten om inhoud te herstellen.')
  const [rev] = await getDb().select().from(revisions).where(eq(revisions.id, str(fd, 'revisionId')))
  if (!rev || rev.entityType !== 'instelling') return fail('Versie niet gevonden.')
  const key = rev.entityId as SettingKey
  if (!EDITABLE.includes(key)) return fail('Dit onderdeel kan hier niet worden hersteld.')
  if (key === 'contact' && !(await actionUser('instellingen:beheren'))) return fail('Alleen de eigenaar kan contactgegevens herstellen.')
  const parsed = SETTINGS[key].safeParse(rev.snapshot)
  if (!parsed.success) return fail('Deze versie voldoet niet meer aan de huidige regels en kan niet worden hersteld.')
  await saveSetting(getDb(), key, parsed.data as never, user.id, `${SETTING_LABELS[key]} hersteld naar een eerdere versie`)
  refresh()
  return done('Eerdere versie hersteld.')
}

/* ───────────── Veelgestelde vragen ───────────── */

const TOPIC_KEYS: string[] = FAQ_TOPICS.map((t) => t.key)

export async function saveFaqAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('inhoud:beheren')
  if (!user) return fail('Je hebt geen rechten om veelgestelde vragen te wijzigen.')
  const id = str(fd, 'faqId')
  const question = str(fd, 'question')
  const answer = str(fd, 'answer')
  const topic = TOPIC_KEYS.includes(str(fd, 'topic')) ? str(fd, 'topic') : 'overig'
  const status = str(fd, 'status') === 'gepubliceerd' ? 'gepubliceerd' : 'concept'
  const errors: Record<string, string> = {}
  if (question.length < 5 || question.length > 140) errors.question = 'Een vraag heeft 5 tot 140 tekens.'
  if (answer.length > 1200) errors.answer = 'Een antwoord is maximaal 1200 tekens.'
  if (status === 'gepubliceerd' && hasPlaceholder(answer)) errors.answer = 'Publiceren kan pas als het antwoord compleet is (geen [invulmarkeringen]).'
  if (Object.keys(errors).length) return fail('Controleer de velden.', errors)
  const db = getDb()
  if (id) {
    const [current] = await db.select().from(faqs).where(eq(faqs.id, id))
    if (!current) return fail('Vraag niet gevonden.')
    await recordRevision(db, { entityType: 'faq', entityId: id, snapshot: current, actorId: user.id, summary: 'Vorige versie' })
    await db.update(faqs).set({ question, answer, topic, status, updatedBy: user.id, updatedAt: new Date() }).where(eq(faqs.id, id))
    await recordAudit(db, {
      actorId: user.id,
      action: current.status !== status ? (status === 'gepubliceerd' ? 'faq.gepubliceerd' : 'faq.gedepubliceerd') : 'faq.bijgewerkt',
      entityType: 'faq',
      entityId: id,
      summary: `Veelgestelde vraag bijgewerkt: ${question}`,
    })
  } else {
    const all = await db.select({ id: faqs.id }).from(faqs)
    const [row] = await db.insert(faqs).values({ question, answer, topic, status, sortOrder: all.length, updatedBy: user.id }).returning({ id: faqs.id })
    await recordAudit(db, { actorId: user.id, action: 'faq.aangemaakt', entityType: 'faq', entityId: row!.id, summary: `Veelgestelde vraag toegevoegd: ${question}` })
  }
  refresh()
  return done(status === 'gepubliceerd' ? 'Opgeslagen en gepubliceerd.' : 'Opgeslagen als concept.')
}

export async function faqCommandAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('inhoud:beheren')
  if (!user) return fail('Je hebt geen rechten om veelgestelde vragen te wijzigen.')
  const [command, id] = str(fd, 'command').split(':')
  const db = getDb()
  const list = await db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.createdAt))
  const i = list.findIndex((f) => f.id === id)
  if (i < 0) return fail('Vraag niet gevonden.')
  if (command === 'verwijderen') {
    await db.delete(faqs).where(eq(faqs.id, id!))
    await recordAudit(db, { actorId: user.id, action: 'faq.verwijderd', entityType: 'faq', entityId: id, summary: `Veelgestelde vraag verwijderd: ${list[i]!.question}` })
  } else if (command === 'omhoog' || command === 'omlaag') {
    const j = command === 'omhoog' ? i - 1 : i + 1
    if (j >= 0 && j < list.length) {
      ;[list[i], list[j]] = [list[j]!, list[i]!]
      for (let k = 0; k < list.length; k++) await db.update(faqs).set({ sortOrder: k }).where(eq(faqs.id, list[k]!.id))
    }
  }
  refresh()
  return done(command === 'verwijderen' ? 'Vraag verwijderd.' : 'Volgorde aangepast.')
}

/* ───────────── Privacy en voorwaarden ───────────── */

export async function savePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('inhoud:beheren')
  if (!user) return fail('Je hebt geen rechten om pagina’s te wijzigen.')
  const slug = str(fd, 'slug')
  if (slug !== 'privacy' && slug !== 'voorwaarden') return fail('Onbekende pagina.')
  const title = str(fd, 'title')
  const body = str(fd, 'body')
  const intent = str(fd, 'intent')
  const errors: Record<string, string> = {}
  if (title.length < 3 || title.length > 80) errors.title = 'Een titel heeft 3 tot 80 tekens.'
  if (body.length > 20_000) errors.body = 'Maximaal 20.000 tekens.'
  if (Object.keys(errors).length) return fail('Controleer de velden.', errors)
  const db = getDb()
  const [current] = await db.select().from(pages).where(eq(pages.slug, slug))
  if (!current) return fail('Pagina niet gevonden.')

  let status = current.status
  let approvedBy = current.approvedBy
  let approvedAt = current.approvedAt
  if (intent === 'publiceren' || intent === 'depubliceren') {
    const owner = await actionUser('paginas:goedkeuren')
    if (!owner) return fail('Alleen de eigenaar kan juridische pagina’s goedkeuren en publiceren.')
    if (intent === 'publiceren') {
      if (hasPlaceholder(body)) return fail('Publiceren kan pas als alle [invulmarkeringen] zijn vervangen.', { body: 'Er staan nog [invulmarkeringen] in de tekst.' })
      status = 'gepubliceerd'
      approvedBy = owner.id
      approvedAt = new Date()
    } else {
      status = 'concept'
    }
  } else if (current.status === 'gepubliceerd' && body !== current.body) {
    // Een gepubliceerde tekst die verandert, moet opnieuw worden goedgekeurd.
    if (!(await actionUser('paginas:goedkeuren'))) {
      status = 'concept'
      approvedBy = null
      approvedAt = null
    } else if (hasPlaceholder(body)) {
      return fail('Een gepubliceerde pagina mag geen [invulmarkeringen] bevatten.', { body: 'Er staan nog [invulmarkeringen] in de tekst.' })
    }
  }
  await recordRevision(db, { entityType: 'pagina', entityId: slug, snapshot: current, actorId: user.id, summary: 'Vorige versie' })
  await db.update(pages).set({ title, body, status, approvedBy, approvedAt, updatedBy: user.id, updatedAt: new Date() }).where(eq(pages.slug, slug))
  await recordAudit(db, {
    actorId: user.id,
    action: intent === 'publiceren' ? 'pagina.gepubliceerd' : intent === 'depubliceren' ? 'pagina.gedepubliceerd' : 'pagina.bijgewerkt',
    entityType: 'pagina',
    entityId: slug,
    summary: `${title} ${intent === 'publiceren' ? 'goedgekeurd en gepubliceerd' : intent === 'depubliceren' ? 'offline gehaald' : 'bijgewerkt'}`,
  })
  refresh()
  if (current.status === 'gepubliceerd' && status === 'concept' && !intent) return done('Opgeslagen. De pagina staat weer in concept tot de eigenaar de nieuwe tekst goedkeurt.')
  return done(intent === 'publiceren' ? 'Goedgekeurd en gepubliceerd.' : intent === 'depubliceren' ? 'Pagina offline gehaald.' : 'Opgeslagen.')
}
