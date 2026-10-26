/**
 * Statussen van aanvragen en reserveringen.
 *
 * Een aanvraag is géén reservering. Pas de status “bevestigd” reserveert de
 * auto. Een tijdelijke optie (optionExpiresAt) houdt de auto vast tot de
 * vervaldatum, zonder dat de aanvraag bevestigd is.
 */

export const RESERVATION_STATUSES = [
  'nieuw',
  'in_behandeling',
  'wacht_op_klant',
  'bevestigd',
  'afgewezen',
  'geannuleerd',
  'afgerond',
] as const

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export const OPEN_STATUSES: readonly ReservationStatus[] = ['nieuw', 'in_behandeling', 'wacht_op_klant']
export const CLOSED_STATUSES: readonly ReservationStatus[] = ['afgewezen', 'geannuleerd', 'afgerond']

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  nieuw: 'Nieuw',
  in_behandeling: 'In behandeling',
  wacht_op_klant: 'Wacht op klant',
  bevestigd: 'Bevestigd',
  afgewezen: 'Afgewezen',
  geannuleerd: 'Geannuleerd',
  afgerond: 'Afgerond',
}

export const STATUS_DESCRIPTIONS: Record<ReservationStatus, string> = {
  nieuw: 'Binnengekomen, nog niet opgepakt.',
  in_behandeling: 'Wordt beoordeeld; de auto is nog niet gereserveerd.',
  wacht_op_klant: 'Er is een vraag of voorstel aan de klant gestuurd.',
  bevestigd: 'Definitief gereserveerd. De auto is in deze periode bezet.',
  afgewezen: 'Niet mogelijk in deze periode of om een andere reden afgewezen.',
  geannuleerd: 'Ingetrokken door klant of bedrijf.',
  afgerond: 'De huurperiode is voorbij en afgehandeld.',
}

/** Toegestane statusovergangen. Heropenen kan vanuit afgewezen/geannuleerd. */
export const ALLOWED_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  nieuw: ['in_behandeling', 'wacht_op_klant', 'bevestigd', 'afgewezen', 'geannuleerd'],
  in_behandeling: ['wacht_op_klant', 'bevestigd', 'afgewezen', 'geannuleerd'],
  wacht_op_klant: ['in_behandeling', 'bevestigd', 'afgewezen', 'geannuleerd'],
  bevestigd: ['afgerond', 'geannuleerd'],
  afgewezen: ['in_behandeling'],
  geannuleerd: ['in_behandeling'],
  afgerond: [],
}

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function isOpen(status: ReservationStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return typeof value === 'string' && (RESERVATION_STATUSES as readonly string[]).includes(value)
}

/** Een tijdelijke optie is alleen actief op een open aanvraag die nog niet verlopen is. */
export function isActiveOption(
  r: { status: ReservationStatus; optionExpiresAt: Date | null },
  now: Date,
): boolean {
  return r.optionExpiresAt !== null && isOpen(r.status) && r.optionExpiresAt.getTime() > now.getTime()
}

/** Weergavecategorie voor kalender en lijsten. */
export type PlanningKind = 'aanvraag' | 'optie' | 'bevestigd' | 'afgerond' | 'gesloten'

export function planningKind(
  r: { status: ReservationStatus; optionExpiresAt: Date | null },
  now: Date,
): PlanningKind {
  if (r.status === 'bevestigd') return 'bevestigd'
  if (r.status === 'afgerond') return 'afgerond'
  if (r.status === 'afgewezen' || r.status === 'geannuleerd') return 'gesloten'
  return isActiveOption(r, now) ? 'optie' : 'aanvraag'
}
