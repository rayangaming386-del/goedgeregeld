import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { PlanningBadge, StatusBadge } from '@/components/admin/Badges'
import { EmptyState, NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { can } from '@/domain/permissions'
import { planningKind, RESERVATION_STATUSES, STATUS_LABELS } from '@/domain/reservation-status'
import { formatDateTimeShort, formatPeriod, isValidDateString, startOfLocalDay, addDaysToDateKey } from '@/domain/time'
import { listRequests, PAGE_SIZE, vehicleOptions } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Aanvragen' }

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  telefoon: 'Telefoon',
  instagram: 'Instagram',
  handmatig: 'Handmatig',
}

export default async function RequestsPage({ searchParams }: PageProps<'/beheer/aanvragen'>) {
  const user = await requireUser()
  if (!can(user.role, 'aanvragen:bekijken')) return <NoAccess />
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const status = get('status') || 'open'
  const auto = get('auto')
  const q = get('q').slice(0, 80)
  const van = isValidDateString(get('van')) ? get('van') : ''
  const tot = isValidDateString(get('tot')) ? get('tot') : ''
  const page = Math.max(1, Number(get('pagina')) || 1)

  const [{ rows, total }, vehicles] = await Promise.all([
    listRequests({
      status,
      auto: auto || undefined,
      q: q || undefined,
      van: van ? startOfLocalDay(van) : undefined,
      tot: tot ? startOfLocalDay(addDaysToDateKey(tot, 1)) : undefined,
      pagina: page,
    }),
    vehicleOptions(),
  ])
  const now = new Date()
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const qs = (p: number) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (auto) params.set('auto', auto)
    if (q) params.set('q', q)
    if (van) params.set('van', van)
    if (tot) params.set('tot', tot)
    params.set('pagina', String(p))
    return `?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        title="Aanvragen"
        description="Een aanvraag blokkeert de auto niet. Zet een tijdelijke optie of bevestig om de auto vast te houden."
        actions={
          can(user.role, 'aanvragen:beheren') ? (
            <Link href="/beheer/aanvragen/nieuw" className="btn btn--primary btn--sm">
              Aanvraag of reservering toevoegen
            </Link>
          ) : null
        }
      />

      <form className="adm-filters" method="get" role="search" aria-label="Aanvragen filteren">
        <div className="field">
          <label className="field__label" htmlFor="f-status">
            Status
          </label>
          <select className="select" id="f-status" name="status" defaultValue={status}>
            <option value="open">Openstaand</option>
            <option value="alle">Alle</option>
            {RESERVATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-auto">
            Auto
          </label>
          <select className="select" id="f-auto" name="auto" defaultValue={auto}>
            <option value="">Alle auto’s</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-van">
            Periode vanaf
          </label>
          <input className="input" type="date" id="f-van" name="van" defaultValue={van} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-tot">
            Periode tot en met
          </label>
          <input className="input" type="date" id="f-tot" name="tot" defaultValue={tot} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-q">
            Zoeken
          </label>
          <input className="input" type="search" id="f-q" name="q" defaultValue={q} placeholder="Naam, telefoon of nummer" />
        </div>
        <button type="submit" className="btn btn--secondary btn--sm">
          Filteren
        </button>
      </form>

      <p className="adm-small" style={{ marginBottom: '0.75rem' }} role="status">
        {total} {total === 1 ? 'resultaat' : 'resultaten'}
      </p>

      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table adm-table--cards">
            <thead>
              <tr>
                <th scope="col">Nummer</th>
                <th scope="col">Klant</th>
                <th scope="col">Auto</th>
                <th scope="col">Periode</th>
                <th scope="col">Status</th>
                <th scope="col">Binnengekomen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kind = planningKind(r, now)
                return (
                  <tr key={r.id}>
                    <td data-label="Nummer">
                      <Link href={`/beheer/aanvragen/${r.id}`} className="adm-mono">
                        {r.reference}
                      </Link>
                    </td>
                    <td data-label="Klant">
                      <span>{r.customerName}</span>
                      <br />
                      <span className="adm-small">{r.customerPhone}</span>
                    </td>
                    <td data-label="Auto">{r.vehicle}</td>
                    <td data-label="Periode">{formatPeriod(r.startAt, r.endAt)}</td>
                    <td data-label="Status">
                      <span className="adm-chips">
                        <StatusBadge status={r.status} />
                        {kind === 'optie' ? <PlanningBadge kind="optie" /> : null}
                      </span>
                    </td>
                    <td data-label="Binnengekomen">
                      {formatDateTimeShort(r.createdAt)}
                      <br />
                      <span className="adm-small">{SOURCE_LABELS[r.source] ?? r.source}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Geen aanvragen gevonden">
          <p className="adm-small">Pas de filters aan of bekijk alle statussen.</p>
        </EmptyState>
      )}

      {pages > 1 ? (
        <nav className="adm-pager" aria-label="Paginering">
          {page > 1 ? <Link href={qs(page - 1)}>Vorige</Link> : <span />}
          <span className="adm-small">
            Pagina {page} van {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)}>Volgende</Link> : <span />}
        </nav>
      ) : null}
    </>
  )
}
