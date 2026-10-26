/**
 * Beschikbaarheid en overlap.
 *
 * Perioden zijn half-open: [start, eind). Een huur die om 10:00 eindigt en een
 * huur die om 10:00 begint, overlappen dus niet.
 *
 * Blokkerend zijn: bevestigde reserveringen, actieve tijdelijke opties,
 * onderhoudsblokkades en handmatige blokkades. Losse aanvragen blokkeren niet.
 */
import { isActiveOption, type ReservationStatus } from './reservation-status'

export type Interval = { start: Date; end: Date }

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

export function isValidInterval(i: Interval): boolean {
  return Number.isFinite(i.start.getTime()) && Number.isFinite(i.end.getTime()) && i.end.getTime() > i.start.getTime()
}

export type BlockingKind = 'bevestigd' | 'optie' | 'onderhoud' | 'blokkade'

export type BlockingItem = Interval & {
  kind: BlockingKind
  id: string
  /** Referentie of reden, voor meldingen in beheer. */
  label: string
}

export type ReservationLike = Interval & {
  id: string
  reference: string
  status: ReservationStatus
  optionExpiresAt: Date | null
}

export type BlockLike = Interval & {
  id: string
  kind: 'onderhoud' | 'blokkade'
  reason: string
}

export const BLOCKING_LABELS: Record<BlockingKind, string> = {
  bevestigd: 'Bevestigde reservering',
  optie: 'Tijdelijke optie',
  onderhoud: 'Onderhoud',
  blokkade: 'Blokkade',
}

/** Alle blokkerende items van één auto, eventueel zonder een bepaalde reservering. */
export function blockingItems(
  reservations: ReservationLike[],
  blocks: BlockLike[],
  now: Date,
  options: { excludeReservationId?: string; excludeBlockId?: string } = {},
): BlockingItem[] {
  const items: BlockingItem[] = []
  for (const r of reservations) {
    if (r.id === options.excludeReservationId) continue
    if (r.status === 'bevestigd') {
      items.push({ kind: 'bevestigd', id: r.id, label: r.reference, start: r.start, end: r.end })
    } else if (isActiveOption(r, now)) {
      items.push({ kind: 'optie', id: r.id, label: r.reference, start: r.start, end: r.end })
    }
  }
  for (const b of blocks) {
    if (b.id === options.excludeBlockId) continue
    items.push({ kind: b.kind, id: b.id, label: b.reason || BLOCKING_LABELS[b.kind], start: b.start, end: b.end })
  }
  return items
}

export function findConflicts(period: Interval, items: BlockingItem[]): BlockingItem[] {
  return items
    .filter((item) => overlaps(period, item))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Overlapwaarschuwingen voor de kalender: open aanvragen die samenvallen met
 * iets blokkerends (die kunnen niet zonder meer bevestigd worden).
 */
export function requestWarnings(
  requests: ReservationLike[],
  items: BlockingItem[],
): Map<string, BlockingItem[]> {
  const result = new Map<string, BlockingItem[]>()
  for (const r of requests) {
    const conflicts = findConflicts(r, items.filter((i) => i.id !== r.id))
    if (conflicts.length) result.set(r.id, conflicts)
  }
  return result
}
