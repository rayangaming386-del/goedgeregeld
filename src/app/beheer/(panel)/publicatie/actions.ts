'use server'

import { revalidatePath } from 'next/cache'
import { done, fail, type ActionState } from '@/components/admin/action-state'
import { SITE_CHECKS, type SiteCheckKey } from '@/domain/content'
import { actionUser } from '@/server/auth/session'
import { getSetting, saveSetting } from '@/server/content/settings'
import { getDb } from '@/server/db/client'
import { publicationReadiness } from '@/server/publication/readiness'

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function refresh() {
  revalidatePath('/beheer', 'layout')
  revalidatePath('/', 'layout')
}

const CHECK_KEYS: string[] = SITE_CHECKS.map((c) => c.key)

/** Logo, contactgegevens en teksten afvinken of de bevestiging intrekken. */
export async function siteCheckAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('brongegevens:bevestigen')
  if (!user) return fail('Alleen de eigenaar kan dit bevestigen.')
  const [key, value] = str(fd, 'controle').split(':')
  if (!key || !CHECK_KEYS.includes(key)) return fail('Onbekende controle.')
  const confirmed = value === 'ja'
  const current = await getSetting('siteChecks')
  const label = SITE_CHECKS.find((c) => c.key === key)!.label
  await saveSetting(
    getDb(),
    'siteChecks',
    { ...current, [key as SiteCheckKey]: confirmed ? { confirmed: true, by: user.name, at: new Date().toISOString() } : { confirmed: false, by: null, at: null } },
    user.id,
    `${label} ${confirmed ? 'bevestigd' : 'niet meer bevestigd'}`,
  )
  // Zonder deze bevestiging mag de site niet live blijven.
  if (!confirmed) await fallBackToConceptIfBlocked(user.id)
  refresh()
  return done(confirmed ? `${label} bevestigd.` : `Bevestiging van ${label.toLowerCase()} ingetrokken.`)
}

export async function pricingRulesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('instellingen:beheren')
  if (!user) return fail('Alleen de eigenaar kan de rekenregels vastleggen.')
  const dayCountingRaw = str(fd, 'dayCounting')
  const vatRaw = str(fd, 'vat')
  const dayCounting = dayCountingRaw === 'per_24_uur' || dayCountingRaw === 'per_kalenderdag' ? dayCountingRaw : null
  const vat = vatRaw === 'inclusief' || vatRaw === 'exclusief' ? vatRaw : 'onbekend'
  const confirmed = fd.get('confirmed') === 'ja'
  const errors: Record<string, string> = {}
  if (confirmed && !dayCounting) errors.dayCounting = 'Kies hoe huurdagen worden geteld.'
  if (confirmed && vat === 'onbekend') errors.vat = 'Kies of prijzen inclusief of exclusief btw zijn.'
  if (Object.keys(errors).length) return fail('Bevestigen kan pas als alle regels zijn ingevuld.', errors)
  await saveSetting(getDb(), 'pricingRules', { dayCounting, vat, confirmed }, user.id, confirmed ? 'Rekenregels bevestigd' : 'Rekenregels bijgewerkt (niet bevestigd)')
  refresh()
  return done(confirmed ? 'Rekenregels bevestigd. De website rekent nu een indicatie uit.' : 'Opgeslagen. Zonder bevestiging rekent de website niets uit.')
}

export async function publicationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await actionUser('instellingen:beheren')
  if (!user) return fail('Alleen de eigenaar kan de website live zetten.')
  const intent = str(fd, 'intent')
  const current = await getSetting('publication')
  const db = getDb()
  switch (intent) {
    case 'live': {
      const r = await publicationReadiness(db)
      if (!r.canGoLive) {
        const open = r.blockers.filter((b) => !b.ok).map((b) => b.label)
        return fail(`Nog niet mogelijk. Open punten: ${open.join(', ')}.`)
      }
      await saveSetting(db, 'publication', { mode: 'live', indexable: false }, user.id, 'Website live gezet (nog niet vindbaar)')
      refresh()
      return done('De website staat live. Onbevestigde gegevens worden nu verborgen. Vindbaarheid staat nog uit.')
    }
    case 'concept':
      await saveSetting(db, 'publication', { mode: 'concept', indexable: false }, user.id, 'Website terug naar concept')
      refresh()
      return done('De website staat weer in concept en is niet vindbaar.')
    case 'vindbaar': {
      if (current.mode !== 'live') return fail('Zet de website eerst live.')
      if (!(await publicationReadiness(db)).siteUrl) return fail('Stel eerst SITE_URL in op het definitieve domein.')
      await saveSetting(db, 'publication', { mode: 'live', indexable: true }, user.id, 'Website vindbaar gemaakt voor zoekmachines')
      refresh()
      return done('Zoekmachines mogen de website nu indexeren.')
    }
    case 'onvindbaar':
      await saveSetting(db, 'publication', { ...current, indexable: false }, user.id, 'Vindbaarheid uitgezet')
      refresh()
      return done('Zoekmachines worden gevraagd de website niet te indexeren.')
    default:
      return fail('Onbekende actie.')
  }
}

/** Als een blokkade ontstaat terwijl de site live staat, gaat die terug naar concept. */
async function fallBackToConceptIfBlocked(actorId: string) {
  const db = getDb()
  const r = await publicationReadiness(db)
  if (r.mode === 'live' && !r.canGoLive) {
    await saveSetting(db, 'publication', { mode: 'concept', indexable: false }, actorId, 'Automatisch terug naar concept: een verplichte bevestiging is ingetrokken')
  }
}
