import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { notFound } from 'next/navigation'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { PlanningBadge, StatusBadge } from '@/components/admin/Badges'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, ArrowLeft, Info, WhatsApp } from '@/components/icons'
import { BLOCKING_LABELS } from '@/domain/availability'
import { can } from '@/domain/permissions'
import { ALLOWED_TRANSITIONS, isOpen, planningKind, STATUS_DESCRIPTIONS, STATUS_LABELS, type ReservationStatus } from '@/domain/reservation-status'
import { phoneForWhatsApp } from '@/domain/request-validation'
import { formatDateTimeLong, formatDateTimeShort, formatDuration, formatPeriod, toLocalInputValues } from '@/domain/time'
import { customerMessage, whatsappUrl } from '@/lib/whatsapp'
import { requestDetail, vehicleOptions } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { conflictsFor, overlappingRequests } from '@/server/reservations/service'
import { addNoteAction, changeStatusAction, setOptionAction, updateCustomerAction, updatePeriodAction } from '../actions'

export const metadata: Metadata = { title: 'Aanvraag' }

const TRANSITION_LABELS: Partial<Record<ReservationStatus, string>> = {
  in_behandeling: 'In behandeling nemen',
  wacht_op_klant: 'Wacht op klant',
  bevestigd: 'Bevestigen',
  afgerond: 'Afronden',
}

const EVENT_LABELS: Record<string, string> = {
  aangemaakt: 'Aangemaakt',
  status: 'Status gewijzigd',
  periode: 'Periode gewijzigd',
  optie: 'Tijdelijke optie',
  notitie: 'Interne notitie toegevoegd',
  klantgegevens: 'Klantgegevens bijgewerkt',
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website-formulier',
  whatsapp: 'WhatsApp',
  telefoon: 'Telefoon',
  instagram: 'Instagram',
  handmatig: 'Handmatig toegevoegd',
}

export default async function RequestDetailPage({ params }: PageProps<'/beheer/aanvragen/[id]'>) {
  const user = await requireUser()
  if (!can(user.role, 'aanvragen:bekijken')) return <NoAccess />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const data = await requestDetail(id)
  if (!data) notFound()
  const { r, vehicle, events, notes } = data
  const canManage = can(user.role, 'aanvragen:beheren')
  const now = new Date()
  const kind = planningKind(r, now)
  const period = { start: r.startAt, end: r.endAt }
  const [conflicts, others, vehicles] = await Promise.all([
    conflictsFor(getDb(), r.vehicleId, period, now, { reservationId: r.id }),
    overlappingRequests(r.vehicleId, period, r.id),
    vehicleOptions(),
  ])
  const s = toLocalInputValues(r.startAt)
  const e = toLocalInputValues(r.endAt)
  const waNumber = phoneForWhatsApp(r.customerPhone)
  const waHref = waNumber
    ? whatsappUrl(waNumber, customerMessage({ name: r.customerName, vehicleName: vehicle.name, start: r.startAt, end: r.endAt, reference: r.reference }))
    : null
  const transitions = ALLOWED_TRANSITIONS[r.status]
  const optionDefault = r.optionExpiresAt ? toLocalInputValues(r.optionExpiresAt) : toLocalInputValues(new Date(now.getTime() + 2 * 86_400_000))

  return (
    <>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/beheer/aanvragen" className="adm-small" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <ArrowLeft size={16} /> Alle aanvragen
        </Link>
      </p>
      <PageHeader
        title={`${r.customerName} · ${vehicle.name}`}
        description={
          <span className="adm-chips" style={{ alignItems: 'center' }}>
            <span className="adm-mono">{r.reference}</span>
            <StatusBadge status={r.status} />
            {kind === 'optie' && r.optionExpiresAt ? <PlanningBadge kind="optie" /> : null}
            <span className="adm-small">
              {SOURCE_LABELS[r.source] ?? r.source} · {formatDateTimeShort(r.createdAt)}
            </span>
          </span>
        }
        actions={
          <>
            {waHref ? (
              <a href={waHref} className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
                <WhatsApp size={16} /> WhatsApp klant
              </a>
            ) : null}
            <a href={`tel:${r.customerPhone.replace(/[^\d+]/g, '')}`} className="btn btn--ghost btn--sm">
              Bellen
            </a>
          </>
        }
      />

      {conflicts.length ? (
        <div className="adm-callout is-warn" role="note" style={{ marginBottom: '1rem' }}>
          <Alert size={18} />
          <div>
            <strong>Overlap met de planning.</strong>{' '}
            {r.status === 'bevestigd' ? 'Deze reservering overlapt met:' : 'Bevestigen of een optie zetten kan pas als dit is opgelost:'}
            <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem' }}>
              {conflicts.map((c) => (
                <li key={`${c.kind}-${c.id}`}>
                  {BLOCKING_LABELS[c.kind]} {c.kind === 'bevestigd' || c.kind === 'optie' ? <Link href={`/beheer/aanvragen/${c.id}`}>{c.label}</Link> : `(${c.label})`} ·{' '}
                  {formatPeriod(c.start, c.end)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {others.length ? (
        <div className="adm-callout" role="note" style={{ marginBottom: '1rem' }}>
          <Info size={18} />
          <div>
            Andere open aanvragen voor deze auto in dezelfde periode:{' '}
            {others.map((o, i) => (
              <span key={o.id}>
                {i ? ', ' : ''}
                <Link href={`/beheer/aanvragen/${o.id}`}>{o.reference}</Link> ({STATUS_LABELS[o.status]})
              </span>
            ))}
            . Aanvragen blokkeren de auto niet.
          </div>
        </div>
      ) : null}

      <div className="adm-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))', alignItems: 'start' }}>
        <div className="adm-grid">
          <section className="adm-panel" aria-labelledby="overzicht-titel">
            <h2 id="overzicht-titel" className="adm-section-title">
              Overzicht
            </h2>
            <dl className="adm-dl">
              <div>
                <dt>Auto</dt>
                <dd>
                  <Link href={`/beheer/wagenpark/${vehicle.id}`}>{vehicle.name}</Link>
                </dd>
              </div>
              <div>
                <dt>Van</dt>
                <dd>{formatDateTimeLong(r.startAt)}</dd>
              </div>
              <div>
                <dt>Tot</dt>
                <dd>{formatDateTimeLong(r.endAt)}</dd>
              </div>
              <div>
                <dt>Duur</dt>
                <dd>{formatDuration(r.startAt, r.endAt)}</dd>
              </div>
              <div>
                <dt>Telefoon</dt>
                <dd>{r.customerPhone}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{r.customerEmail ? <a href={`mailto:${r.customerEmail}`}>{r.customerEmail}</a> : <span className="adm-muted">Niet opgegeven</span>}</dd>
              </div>
              <div>
                <dt>Bericht klant</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{r.customerMessage || <span className="adm-muted">Geen bericht</span>}</dd>
              </div>
              {r.confirmedAt ? (
                <div>
                  <dt>Bevestigd</dt>
                  <dd>{formatDateTimeShort(r.confirmedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {canManage ? (
            <section className="adm-panel" aria-labelledby="status-titel">
              <h2 id="status-titel" className="adm-section-title">
                Status
              </h2>
              <p className="adm-muted">{STATUS_DESCRIPTIONS[r.status]}</p>
              {transitions.length ? (
                <ActionForm action={changeStatusAction} className="adm-form" aria-label="Status wijzigen">
                  <input type="hidden" name="reservationId" value={r.id} />
                  <div className="adm-form-actions">
                    {transitions.map((t) =>
                      t === 'afgewezen' || t === 'geannuleerd' ? (
                        <ConfirmSubmit
                          key={t}
                          name="to"
                          value={t}
                          label={t === 'afgewezen' ? 'Afwijzen' : 'Annuleren'}
                          title={t === 'afgewezen' ? 'Aanvraag afwijzen?' : 'Reservering annuleren?'}
                          description={
                            t === 'afgewezen'
                              ? 'De aanvraag wordt gesloten. Laat de klant zelf weten dat het niet mogelijk is.'
                              : 'De reservering wordt geannuleerd en de auto komt weer vrij in de planning.'
                          }
                          confirmLabel={t === 'afgewezen' ? 'Afwijzen' : 'Annuleren'}
                        />
                      ) : (
                        <SubmitButton key={t} name="to" value={t} variant={t === 'bevestigd' ? 'primary' : 'secondary'}>
                          {r.status === 'afgewezen' || r.status === 'geannuleerd' ? 'Heropenen' : TRANSITION_LABELS[t]}
                        </SubmitButton>
                      ),
                    )}
                  </div>
                  {transitions.includes('bevestigd') ? (
                    <p className="adm-small">Bevestigen controleert eerst op overlap met andere bevestigde reserveringen, opties en blokkades.</p>
                  ) : null}
                  <FormMessage />
                </ActionForm>
              ) : (
                <p className="adm-small">Deze aanvraag is afgerond.</p>
              )}
            </section>
          ) : null}

          {canManage && isOpen(r.status) ? (
            <section className="adm-panel" aria-labelledby="optie-titel">
              <h2 id="optie-titel" className="adm-section-title">
                Tijdelijke optie
              </h2>
              <p className="adm-muted">
                Een optie houdt de auto vast tot de vervaldatum, zonder dat de aanvraag bevestigd is. Na de vervaldatum blokkeert de aanvraag niet
                meer.
              </p>
              {r.optionExpiresAt ? (
                <p>
                  {r.optionExpiresAt.getTime() > now.getTime() ? 'Actief tot ' : 'Verlopen op '}
                  <strong>{formatDateTimeLong(r.optionExpiresAt)}</strong>
                </p>
              ) : null}
              <ActionForm action={setOptionAction} className="adm-form" aria-label="Tijdelijke optie">
                <input type="hidden" name="reservationId" value={r.id} />
                <div className="adm-form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="optionDate">
                      Vervalt op
                    </label>
                    <input className="input" type="date" id="optionDate" name="optionDate" defaultValue={optionDefault.date} />
                    <FieldError name="optionDate" />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="optionTime">
                      Om
                    </label>
                    <input className="input" type="time" id="optionTime" name="optionTime" step={900} defaultValue={optionDefault.time} />
                  </div>
                </div>
                <div className="adm-form-actions">
                  <SubmitButton name="intent" value="zetten">
                    {r.optionExpiresAt ? 'Optie wijzigen' : 'Optie zetten'}
                  </SubmitButton>
                  {r.optionExpiresAt ? (
                    <SubmitButton name="intent" value="verwijderen" variant="secondary">
                      Optie verwijderen
                    </SubmitButton>
                  ) : null}
                </div>
                <FormMessage />
              </ActionForm>
            </section>
          ) : null}

          {canManage && r.status !== 'afgerond' && r.status !== 'afgewezen' && r.status !== 'geannuleerd' ? (
            <section className="adm-panel" aria-labelledby="periode-titel">
              <h2 id="periode-titel" className="adm-section-title">
                Auto en periode aanpassen
              </h2>
              <ActionForm action={updatePeriodAction} className="adm-form" aria-label="Periode aanpassen">
                <input type="hidden" name="reservationId" value={r.id} />
                <div className="adm-form-grid">
                  <div className="field is-wide">
                    <label className="field__label" htmlFor="vehicleId">
                      Auto
                    </label>
                    <select className="select" id="vehicleId" name="vehicleId" defaultValue={r.vehicleId}>
                      {vehicles
                        .filter((v) => v.status !== 'gearchiveerd' || v.id === r.vehicleId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="startDate">
                      Begindatum
                    </label>
                    <input className="input" type="date" id="startDate" name="startDate" defaultValue={s.date} />
                    <FieldError name="startDate" />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="startTime">
                      Begintijd
                    </label>
                    <input className="input" type="time" id="startTime" name="startTime" step={900} defaultValue={s.time} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="endDate">
                      Einddatum
                    </label>
                    <input className="input" type="date" id="endDate" name="endDate" defaultValue={e.date} />
                    <FieldError name="endDate" />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="endTime">
                      Eindtijd
                    </label>
                    <input className="input" type="time" id="endTime" name="endTime" step={900} defaultValue={e.time} />
                  </div>
                </div>
                <p className="adm-small">Tijden in Nederlandse tijd (Europe/Amsterdam). Bij een bevestigde reservering of actieve optie wordt op overlap gecontroleerd.</p>
                <div className="adm-form-actions">
                  <SubmitButton>Periode opslaan</SubmitButton>
                </div>
                <FormMessage />
              </ActionForm>
            </section>
          ) : null}

          {canManage ? (
            <section className="adm-panel" aria-labelledby="klant-titel">
              <h2 id="klant-titel" className="adm-section-title">
                Klantgegevens
              </h2>
              <ActionForm action={updateCustomerAction} className="adm-form" aria-label="Klantgegevens">
                <input type="hidden" name="reservationId" value={r.id} />
                <div className="adm-form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="c-name">
                      Naam
                    </label>
                    <input className="input" id="c-name" name="name" defaultValue={r.customerName} maxLength={80} autoComplete="off" />
                    <FieldError name="name" />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="c-phone">
                      Telefoon
                    </label>
                    <input className="input" id="c-phone" name="phone" type="tel" defaultValue={r.customerPhone} maxLength={24} autoComplete="off" />
                    <FieldError name="phone" />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="c-email">
                      E-mail
                    </label>
                    <input className="input" id="c-email" name="email" type="email" defaultValue={r.customerEmail ?? ''} maxLength={120} autoComplete="off" />
                    <FieldError name="email" />
                  </div>
                </div>
                <div className="adm-form-actions">
                  <SubmitButton variant="secondary">Klantgegevens opslaan</SubmitButton>
                </div>
                <FormMessage />
              </ActionForm>
            </section>
          ) : null}
        </div>

        <div className="adm-grid">
          <section className="adm-panel" aria-labelledby="notities-titel">
            <h2 id="notities-titel" className="adm-section-title">
              Interne notities
            </h2>
            <p className="adm-small">Alleen zichtbaar in het beheer, nooit voor de klant of op de website.</p>
            {canManage ? (
              <ActionForm action={addNoteAction} className="adm-form" resetOnSuccess aria-label="Notitie toevoegen">
                <input type="hidden" name="reservationId" value={r.id} />
                <div className="field">
                  <label className="field__label" htmlFor="note-body">
                    Nieuwe notitie
                  </label>
                  <textarea className="textarea" id="note-body" name="body" rows={3} maxLength={2000} />
                </div>
                <div className="adm-form-actions">
                  <SubmitButton variant="secondary">Notitie toevoegen</SubmitButton>
                </div>
                <FormMessage />
              </ActionForm>
            ) : null}
            {notes.length ? (
              <ul className="adm-list">
                {notes.map((n) => (
                  <li key={n.id} style={{ display: 'grid', gap: '0.25rem' }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
                    <p className="adm-small">
                      {n.author ?? 'Onbekend'} · {formatDateTimeShort(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-small">Nog geen notities.</p>
            )}
          </section>

          <section className="adm-panel" aria-labelledby="historie-titel">
            <h2 id="historie-titel" className="adm-section-title">
              Statusgeschiedenis
            </h2>
            <ol className="adm-timeline">
              {events.map((ev) => (
                <li key={ev.id}>
                  <span>
                    <strong>{EVENT_LABELS[ev.kind] ?? ev.kind}</strong>
                    {ev.kind === 'status' && ev.fromStatus && ev.toStatus ? `: ${STATUS_LABELS[ev.fromStatus]} → ${STATUS_LABELS[ev.toStatus]}` : null}
                    {ev.kind === 'aangemaakt' && ev.toStatus ? ` als ${STATUS_LABELS[ev.toStatus].toLowerCase()}` : null}
                  </span>
                  {ev.kind === 'periode' && ev.data ? (
                    <span className="adm-small">
                      {String(ev.data.van)} → {String(ev.data.naar)}
                      {ev.data.autoVan ? ` · ${String(ev.data.autoVan)} → ${String(ev.data.autoNaar)}` : ''}
                    </span>
                  ) : null}
                  {ev.kind === 'optie' && ev.data ? (
                    <span className="adm-small">
                      {ev.data.naar ? `Geldig tot ${formatDateTimeShort(new Date(String(ev.data.naar)))}` : 'Verwijderd'}
                    </span>
                  ) : null}
                  <span className="adm-small">
                    {ev.actor ?? (ev.kind === 'aangemaakt' ? 'Website' : 'Systeem')} · {formatDateTimeShort(ev.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  )
}
