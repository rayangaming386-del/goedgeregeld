import { Alert, Calendar, Check, Clock, Hexagon, Info, Lock } from '@/components/icons'
import { BLOCKING_LABELS } from '@/domain/availability'
import { STATUS_LABELS, type PlanningKind, type ReservationStatus } from '@/domain/reservation-status'

const STATUS_TONE: Record<ReservationStatus, string> = {
  nieuw: 'info',
  in_behandeling: 'warn',
  wacht_op_klant: 'warn',
  bevestigd: 'ok',
  afgewezen: 'muted',
  geannuleerd: 'muted',
  afgerond: 'muted',
}

function StatusIcon({ status }: { status: ReservationStatus }) {
  switch (status) {
    case 'nieuw':
      return <Info size={14} />
    case 'in_behandeling':
    case 'wacht_op_klant':
      return <Clock size={14} />
    case 'bevestigd':
      return <Check size={14} />
    default:
      return <Hexagon size={14} />
  }
}

/** Status met icoon én tekst (kleur is nooit het enige onderscheid). */
export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={`adm-badge tone-${STATUS_TONE[status]}`}>
      <StatusIcon status={status} />
      {STATUS_LABELS[status]}
    </span>
  )
}

export const PLANNING_LABELS: Record<PlanningKind | 'onderhoud' | 'blokkade', string> = {
  aanvraag: 'Aanvraag',
  optie: 'Optie',
  bevestigd: 'Bevestigd',
  afgerond: 'Afgerond',
  gesloten: 'Gesloten',
  onderhoud: BLOCKING_LABELS.onderhoud,
  blokkade: BLOCKING_LABELS.blokkade,
}

export function PlanningIcon({ kind, size = 14 }: { kind: PlanningKind | 'onderhoud' | 'blokkade'; size?: number }) {
  switch (kind) {
    case 'aanvraag':
      return <Info size={size} />
    case 'optie':
      return <Clock size={size} />
    case 'bevestigd':
      return <Check size={size} />
    case 'onderhoud':
      return <Alert size={size} />
    case 'blokkade':
      return <Lock size={size} />
    default:
      return <Calendar size={size} />
  }
}

export function PlanningBadge({ kind }: { kind: PlanningKind | 'onderhoud' | 'blokkade' }) {
  return (
    <span className={`adm-badge kind-${kind}`}>
      <PlanningIcon kind={kind} />
      {PLANNING_LABELS[kind]}
    </span>
  )
}
