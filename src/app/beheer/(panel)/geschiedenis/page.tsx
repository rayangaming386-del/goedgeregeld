import { asc } from 'drizzle-orm'
import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { EmptyState, NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { SETTING_LABELS, type SettingKey } from '@/domain/content'
import { can } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { formatEuro } from '@/lib/format'
import { auditEntries } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { users } from '@/server/db/schema'

export const metadata: Metadata = { title: 'Wijzigingsgeschiedenis' }

const TYPES: Record<string, string> = {
  aanvraag: 'Aanvragen en reserveringen',
  blokkade: 'Blokkades',
  auto: 'Wagenpark',
  foto: 'Foto’s',
  actie: 'Acties',
  instelling: 'Website-inhoud en instellingen',
  faq: 'Veelgestelde vragen',
  pagina: 'Privacy en voorwaarden',
  gebruiker: 'Gebruikers en logins',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Waar de gebruiker het onderdeel kan bekijken of een eerdere versie kan herstellen. */
function entityLink(type: string, id: string | null): { href: string; label: string } | null {
  switch (type) {
    case 'aanvraag':
      return id ? { href: `/beheer/aanvragen/${id}`, label: 'Aanvraag openen' } : null
    case 'auto':
      return id ? { href: `/beheer/wagenpark/${id}?tab=historie`, label: 'Historie van de auto' } : null
    case 'blokkade':
      return { href: '/beheer/kalender', label: 'Kalender' }
    case 'actie':
      return { href: '/beheer/acties', label: 'Acties' }
    case 'instelling':
      return { href: '/beheer/inhoud?tab=versies', label: 'Eerdere versies' }
    case 'faq':
      return { href: '/beheer/inhoud?tab=faq', label: 'Veelgestelde vragen' }
    case 'pagina':
      return { href: '/beheer/inhoud?tab=paginas', label: 'Privacy en voorwaarden' }
    case 'gebruiker':
      return { href: '/beheer/gebruikers', label: 'Gebruikers' }
    default:
      return null
  }
}

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'leeg'
  if (typeof value === 'boolean') return value ? 'ja' : 'nee'
  if (typeof value === 'number' && /cents$/i.test(field)) return formatEuro(value)
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}

export default async function HistoryPage({ searchParams }: PageProps<'/beheer/geschiedenis'>) {
  const user = await requireUser()
  if (!can(user.role, 'geschiedenis:bekijken')) return <NoAccess />
  const sp = await searchParams
  const type = typeof sp.type === 'string' && sp.type in TYPES ? sp.type : ''
  const gebruiker = typeof sp.gebruiker === 'string' && UUID.test(sp.gebruiker) ? sp.gebruiker : ''
  const pagina = Math.max(1, Number(sp.pagina) || 1)
  const [{ rows, total, page }, people] = await Promise.all([
    auditEntries({ type: type || undefined, gebruiker: gebruiker || undefined, pagina }),
    getDb().select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
  ])
  const pages = Math.max(1, Math.ceil(total / 50))
  const qs = (p: number) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (gebruiker) params.set('gebruiker', gebruiker)
    params.set('pagina', String(p))
    return `?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        title="Wijzigingsgeschiedenis"
        description="Wie wat heeft gewijzigd en wanneer. Een eerdere versie herstel je bij het onderdeel zelf: bij een auto onder Historie, bij website-inhoud onder Eerdere versies."
      />
      <form className="adm-filters" method="get" role="search" aria-label="Geschiedenis filteren">
        <div className="field">
          <label className="field__label" htmlFor="g-type">
            Onderdeel
          </label>
          <select className="select" id="g-type" name="type" defaultValue={type}>
            <option value="">Alles</option>
            {Object.entries(TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="g-gebruiker">
            Door
          </label>
          <select className="select" id="g-gebruiker" name="gebruiker" defaultValue={gebruiker}>
            <option value="">Iedereen</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-filters__actions">
          <button type="submit" className="btn btn--secondary btn--sm">
            Filteren
          </button>
          {type || gebruiker ? (
            <Link href="/beheer/geschiedenis" className="btn btn--ghost btn--sm">
              Wissen
            </Link>
          ) : null}
        </div>
      </form>

      <p className="adm-small" style={{ marginBottom: '0.75rem' }} role="status">
        {total} {total === 1 ? 'wijziging' : 'wijzigingen'}
      </p>

      {rows.length ? (
        <ol className="adm-timeline adm-audit">
          {rows.map((r) => {
            const link = entityLink(r.entityType, r.entityId)
            const changes = r.changes ? Object.entries(r.changes) : []
            return (
              <li key={r.id}>
                <div className="adm-audit__head">
                  <p>
                    <strong>{r.summary}</strong>
                  </p>
                  <span className="chip">{TYPES[r.entityType] ?? r.entityType}</span>
                </div>
                <p className="adm-small">
                  <time dateTime={r.createdAt.toISOString()}>{formatDateTimeShort(r.createdAt)}</time> ·{' '}
                  {r.actor ?? (r.entityType === 'aanvraag' ? 'Via de website' : 'Systeem')}
                  {r.entityType === 'instelling' && r.entityId ? ` · ${SETTING_LABELS[r.entityId as SettingKey] ?? r.entityId}` : ''}
                  {link ? (
                    <>
                      {' · '}
                      <Link href={link.href}>{link.label}</Link>
                    </>
                  ) : null}
                </p>
                {changes.length ? (
                  <details>
                    <summary className="adm-small">
                      {changes.length} {changes.length === 1 ? 'veld' : 'velden'} gewijzigd
                    </summary>
                    <dl className="adm-dl adm-changes">
                      {changes.map(([field, c]) => (
                        <div key={field}>
                          <dt>{field}</dt>
                          <dd>
                            <span className="adm-changes__from">{show(field, c.van)}</span>
                            <span aria-hidden="true"> → </span>
                            <span className="visually-hidden"> werd </span>
                            <span>{show(field, c.naar)}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState title="Nog geen wijzigingen gevonden" />
      )}

      {pages > 1 ? (
        <nav className="adm-pager" aria-label="Paginering">
          {page > 1 ? <Link href={qs(page - 1)}>Nieuwer</Link> : <span />}
          <span className="adm-small">
            Pagina {page} van {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)}>Ouder</Link> : <span />}
        </nav>
      ) : null}
    </>
  )
}
