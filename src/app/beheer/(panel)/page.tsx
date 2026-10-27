import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { PlanningBadge } from '@/components/admin/Badges'
import { EmptyState, PageHeader } from '@/components/admin/PageHeader'
import { Alert, Check, Info } from '@/components/icons'
import { can } from '@/domain/permissions'
import { formatDateTimeShort, formatPeriod } from '@/domain/time'
import { siteUrl } from '@/lib/site'
import { dashboardData } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'
import { getSetting } from '@/server/content/settings'
import { mailConfigured } from '@/server/mail'
import { storageKind } from '@/server/storage'
import { VEHICLE_STATUS_LABELS } from './wagenpark/labels'

export const metadata: Metadata = { title: 'Dashboard' }

const STORAGE_LABELS = { local: 'Lokale schijf', s3: 'Object storage (S3)', database: 'Database' } as const

function storageLabel(): string {
  try {
    return STORAGE_LABELS[storageKind()]
  } catch {
    return 'Onjuist ingesteld (MEDIA_STORAGE)'
  }
}

export default async function DashboardPage() {
  const user = await requireUser()
  const [data, publication] = await Promise.all([dashboardData(), getSetting('publication')])
  const seesRequests = can(user.role, 'aanvragen:bekijken')
  const seesContent = can(user.role, 'inhoud:beheren') || can(user.role, 'wagenpark:bewerken')
  const first = user.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={`Goedendag${first ? `, ${first}` : ''}`}
        description={
          publication.mode === 'concept'
            ? 'De website staat in conceptmodus: niet geïndexeerd, met onbevestigde gegevens gemarkeerd als indicatie.'
            : 'De website staat live.'
        }
        actions={
          seesRequests ? (
            <Link href="/beheer/aanvragen/nieuw" className="btn btn--primary btn--sm">
              Aanvraag toevoegen
            </Link>
          ) : null
        }
      />

      <div className="adm-grid adm-grid--stats" style={{ marginBottom: '1.5rem' }}>
        {seesRequests ? (
          <>
            <Link href="/beheer/aanvragen?status=nieuw" className={`adm-stat ${data.newCount ? 'is-attention' : ''}`}>
              <span className="adm-stat__value">{data.newCount}</span>
              <span className="adm-stat__label">Nieuwe aanvragen</span>
              <span className="adm-stat__hint">Nog niet opgepakt</span>
            </Link>
            <Link href="/beheer/aanvragen?status=open" className="adm-stat">
              <span className="adm-stat__value">{data.openCount}</span>
              <span className="adm-stat__label">Openstaand</span>
              <span className="adm-stat__hint">Nieuw, in behandeling of wacht op klant</span>
            </Link>
            <Link href="/beheer/kalender" className="adm-stat">
              <span className="adm-stat__value">{data.upcoming.length}</span>
              <span className="adm-stat__label">Komende reserveringen</span>
              <span className="adm-stat__hint">Bevestigd, komende 30 dagen</span>
            </Link>
            <Link href="/beheer/kalender" className="adm-stat">
              <span className="adm-stat__value">{data.blocks.length}</span>
              <span className="adm-stat__label">Geplande blokkades</span>
              <span className="adm-stat__hint">Onderhoud en handmatig</span>
            </Link>
          </>
        ) : null}
        {can(user.role, 'acties:beheren') ? (
          <Link href="/beheer/acties" className="adm-stat">
            <span className="adm-stat__value">{data.activePromos.length}</span>
            <span className="adm-stat__label">Actieve acties</span>
            <span className="adm-stat__hint">Live en binnen de geldigheid</span>
          </Link>
        ) : null}
        <Link href="/beheer/publicatie" className={`adm-stat ${data.unconfirmed ? 'is-attention' : ''}`}>
          <span className="adm-stat__value">{data.unconfirmed}</span>
          <span className="adm-stat__label">Te bevestigen gegevens</span>
          <span className="adm-stat__hint">Prijzen, borg, specificaties en voorwaarden</span>
        </Link>
      </div>

      <div className="adm-grid adm-grid--2">
        {seesRequests ? (
          <section className="adm-panel" aria-labelledby="nieuw-titel">
            <div className="adm-panel__head">
              <h2 id="nieuw-titel" className="adm-section-title">
                Nieuwe aanvragen
              </h2>
              <Link href="/beheer/aanvragen?status=nieuw" className="adm-small">
                Alle nieuwe aanvragen
              </Link>
            </div>
            {data.latestNew.length ? (
              <ul className="adm-list">
                {data.latestNew.map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href={`/beheer/aanvragen/${r.id}`}>
                        <strong>{r.customerName}</strong> · {r.vehicle}
                      </Link>
                      <p className="adm-small">{formatPeriod(r.startAt, r.endAt)}</p>
                    </div>
                    <span className="adm-small">
                      <span className="adm-mono">{r.reference}</span> · binnen {formatDateTimeShort(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Geen nieuwe aanvragen" />
            )}
          </section>
        ) : null}

        {seesRequests ? (
          <section className="adm-panel" aria-labelledby="komend-titel">
            <div className="adm-panel__head">
              <h2 id="komend-titel" className="adm-section-title">
                Komende bevestigde reserveringen
              </h2>
              <Link href="/beheer/kalender" className="adm-small">
                Naar de kalender
              </Link>
            </div>
            {data.upcoming.length ? (
              <ul className="adm-list">
                {data.upcoming.map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href={`/beheer/aanvragen/${r.id}`}>
                        <strong>{r.vehicle}</strong> · {r.customerName}
                      </Link>
                      <p className="adm-small">{formatPeriod(r.startAt, r.endAt)}</p>
                    </div>
                    <PlanningBadge kind="bevestigd" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Geen bevestigde reserveringen in de komende 30 dagen" />
            )}
          </section>
        ) : null}

        {seesRequests ? (
          <section className="adm-panel" aria-labelledby="blok-titel">
            <h2 id="blok-titel" className="adm-section-title">
              Auto’s met blokkades
            </h2>
            {data.blocks.length ? (
              <ul className="adm-list">
                {data.blocks.map((b) => (
                  <li key={b.id}>
                    <div>
                      <strong>{b.vehicle}</strong>
                      <p className="adm-small">
                        {formatPeriod(b.startAt, b.endAt)}
                        {b.reason ? ` · ${b.reason}` : ''}
                      </p>
                    </div>
                    <PlanningBadge kind={b.kind} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Geen geplande blokkades" />
            )}
          </section>
        ) : null}

        <section className="adm-panel" aria-labelledby="gewijzigd-titel">
          <div className="adm-panel__head">
            <h2 id="gewijzigd-titel" className="adm-section-title">
              Recent gewijzigde auto’s
            </h2>
            <Link href="/beheer/wagenpark" className="adm-small">
              Naar het wagenpark
            </Link>
          </div>
          <ul className="adm-list">
            {data.recentVehicles.map((v) => (
              <li key={v.id}>
                <Link href={`/beheer/wagenpark/${v.id}`}>{v.name}</Link>
                <span className="adm-small">
                  {VEHICLE_STATUS_LABELS[v.status]} · {formatDateTimeShort(v.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {seesContent || can(user.role, 'acties:beheren') ? (
          <section className="adm-panel" aria-labelledby="goedkeuring-titel">
            <h2 id="goedkeuring-titel" className="adm-section-title">
              Wacht op de eigenaar
            </h2>
            <ul className="adm-list">
              <li>
                <Link href="/beheer/publicatie">Gegevens van auto’s die de eigenaar nog moet bevestigen</Link>
                <strong>{data.unconfirmed}</strong>
              </li>
              <li>
                <Link href="/beheer/inhoud?tab=faq">Veelgestelde vragen in concept</Link>
                <strong>{data.conceptFaqs}</strong>
              </li>
              {data.conceptPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/beheer/inhoud?tab=paginas`}>{p.title} (niet gepubliceerd)</Link>
                  <span className="adm-small">concept</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="adm-panel" aria-labelledby="koppelingen-titel">
          <h2 id="koppelingen-titel" className="adm-section-title">
            Koppelingen
          </h2>
          <ul className="adm-list">
            <li>
              <span>Aanvragen opslaan in de database</span>
              <span className="adm-badge tone-ok">
                <Check size={14} /> Actief
              </span>
            </li>
            <li>
              <span>E-mailmelding bij nieuwe aanvraag</span>
              {mailConfigured() ? (
                <span className="adm-badge tone-ok">
                  <Check size={14} /> Gekoppeld
                </span>
              ) : (
                <span className="adm-badge tone-warn">
                  <Alert size={14} /> Niet gekoppeld
                </span>
              )}
            </li>
            <li>
              <span>Domein (SITE_URL)</span>
              {siteUrl() ? (
                <span className="adm-badge tone-ok">
                  <Check size={14} /> {siteUrl()}
                </span>
              ) : (
                <span className="adm-badge tone-warn">
                  <Info size={14} /> Nog niet ingesteld
                </span>
              )}
            </li>
            <li>
              <span>Media-opslag</span>
              <span className="adm-badge tone-info">
                <Info size={14} /> {storageLabel()}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
