import { and, asc, desc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { notFound } from 'next/navigation'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, ArrowLeft, Check, Info } from '@/components/icons'
import { can } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { centsToInput, formatTenths } from '@/lib/format'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { auditLog, media, revisions, users, vehicles, vehicleVerifications } from '@/server/db/schema'
import { uploadLimitBytes } from '@/server/media/pipeline'
import { getStorage } from '@/server/storage'
import { VERIFICATION_FIELDS } from '@/server/vehicles/service'
import {
  deleteVehicleAction,
  restoreRevisionAction,
  setFeaturedAction,
  setStatusAction,
  setVerificationAction,
  updateGeneralAction,
  updatePricingAction,
  updateSeoAction,
  updateSpecsAction,
} from '../actions'
import { VEHICLE_STATUS_LABELS } from '../labels'
import { CharCount } from './CharCount'
import { PhotoManager, type AdminPhoto } from './PhotoManager'

export const metadata: Metadata = { title: 'Auto bewerken' }

const TABS = [
  { key: 'algemeen', label: 'Algemeen' },
  { key: 'specificaties', label: 'Specificaties en voorwaarden' },
  { key: 'prijzen', label: 'Prijzen' },
  { key: 'fotos', label: 'Foto’s' },
  { key: 'seo', label: 'URL en vindbaarheid' },
  { key: 'brongegevens', label: 'Brongegevens' },
  { key: 'historie', label: 'Historie' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default async function VehicleEditPage({ params, searchParams }: PageProps<'/beheer/wagenpark/[id]'>) {
  const user = await requireUser()
  if (!can(user.role, 'wagenpark:bekijken')) return <NoAccess />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const sp = await searchParams
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? 'algemeen') as TabKey
  const db = getDb()
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id))
  if (!v) notFound()

  const [photoRows, verifications, revs, audits] = await Promise.all([
    db.select().from(media).where(eq(media.vehicleId, id)).orderBy(asc(media.sortOrder)),
    db
      .select({ field: vehicleVerifications.field, confirmedAt: vehicleVerifications.confirmedAt, by: users.name })
      .from(vehicleVerifications)
      .leftJoin(users, eq(users.id, vehicleVerifications.confirmedBy))
      .where(eq(vehicleVerifications.vehicleId, id)),
    tab === 'historie'
      ? db
          .select({ id: revisions.id, summary: revisions.summary, createdAt: revisions.createdAt, by: users.name })
          .from(revisions)
          .leftJoin(users, eq(users.id, revisions.actorId))
          .where(and(eq(revisions.entityType, 'auto'), eq(revisions.entityId, id)))
          .orderBy(desc(revisions.createdAt))
          .limit(20)
      : Promise.resolve([]),
    tab === 'historie'
      ? db
          .select({ id: auditLog.id, summary: auditLog.summary, changes: auditLog.changes, createdAt: auditLog.createdAt, by: users.name })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.actorId))
          .where(and(eq(auditLog.entityType, 'auto'), eq(auditLog.entityId, id)))
          .orderBy(desc(auditLog.createdAt))
          .limit(30)
      : Promise.resolve([]),
  ])
  const confirmed = new Map(verifications.map((x) => [x.field, x]))
  const canEdit = can(user.role, 'wagenpark:bewerken')
  const canConfirm = can(user.role, 'brongegevens:bevestigen')
  const canPrice = can(user.role, 'prijzen:beheren')
  const storage = getStorage()
  const photos: AdminPhoto[] = photoRows.map((m) => {
    const webp = m.variants.filter((x) => x.format === 'webp').sort((a, b) => a.width - b.width)
    const pick = webp.find((x) => x.width >= 768) ?? webp.at(-1)
    return {
      id: m.id,
      src: pick ? storage.publicUrl(pick.key) : '',
      width: m.width,
      height: m.height,
      alt: m.alt,
      focalX: m.focalX,
      focalY: m.focalY,
      isPublic: m.isPublic,
      isPrimary: v.primaryMediaId === m.id,
      note: m.note,
      originalName: m.originalName,
      bytes: m.bytes,
    }
  })

  const confirmBox = (name: string, field: (typeof VERIFICATION_FIELDS)[number]['field']) =>
    canConfirm ? (
      <label className="adm-check">
        <input type="checkbox" name={name} defaultChecked={confirmed.has(field)} />
        <span>
          Ik bevestig dat deze gegevens kloppen ({VERIFICATION_FIELDS.find((f) => f.field === field)?.label.toLowerCase()})
        </span>
      </label>
    ) : (
      <p className="adm-small">
        <Info size={14} /> Wijzigen trekt een eerdere bevestiging in; de eigenaar bevestigt opnieuw.
      </p>
    )

  return (
    <>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/beheer/wagenpark" className="adm-small" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <ArrowLeft size={16} /> Wagenpark
        </Link>
      </p>
      <PageHeader
        title={v.name}
        description={
          <span className="adm-chips" style={{ alignItems: 'center' }}>
            <span className={`adm-badge ${v.status === 'gepubliceerd' ? 'tone-ok' : v.status === 'concept' ? 'tone-info' : 'tone-muted'}`}>
              {v.status === 'gepubliceerd' ? <Check size={12} /> : <Info size={12} />}
              {VEHICLE_STATUS_LABELS[v.status]}
            </span>
            <span className="adm-small">
              {confirmed.size} van {VERIFICATION_FIELDS.length} gegevens bevestigd · gewijzigd {formatDateTimeShort(v.updatedAt)}
            </span>
          </span>
        }
        actions={
          <>
            {v.status === 'gepubliceerd' ? (
              <Link href={`/wagenpark/${v.slug}`} className="btn btn--ghost btn--sm" target="_blank" rel="noopener">
                Bekijk op website
              </Link>
            ) : null}
            <Link href={`/beheer/wagenpark/${v.id}/voorbeeld`} className="btn btn--ghost btn--sm">
              Voorbeeld
            </Link>
          </>
        }
      />

      {sp.aangemaakt ? (
        <p className="adm-message is-ok" role="status" style={{ marginBottom: '1rem' }}>
          <Check size={16} /> Concept aangemaakt. Vul de gegevens aan, voeg foto’s toe en publiceer daarna.
        </p>
      ) : null}

      <section className="adm-panel" style={{ marginBottom: '1.25rem' }} aria-label="Publicatie">
        <ActionForm action={setStatusAction} className="adm-form-actions" aria-label="Status">
          <input type="hidden" name="vehicleId" value={v.id} />
          {v.status !== 'gepubliceerd' && can(user.role, 'wagenpark:publiceren') ? (
            <SubmitButton name="status" value="gepubliceerd">
              Publiceren
            </SubmitButton>
          ) : null}
          {v.status === 'gepubliceerd' && can(user.role, 'wagenpark:publiceren') ? (
            <SubmitButton name="status" value="concept" variant="secondary">
              Offline halen (concept)
            </SubmitButton>
          ) : null}
          {v.status !== 'gearchiveerd' && can(user.role, 'wagenpark:archiveren') ? (
            <ConfirmSubmit
              label="Archiveren"
              title="Auto archiveren?"
              description="De auto verdwijnt van de website en uit de keuzes voor nieuwe aanvragen. Aanvragen en reserveringen blijven bewaard."
              confirmLabel="Archiveren"
              name="status"
              value="gearchiveerd"
              variant="secondary"
            />
          ) : null}
          <FormMessage />
        </ActionForm>
        <div className="adm-form-actions">
          {canEdit && v.status !== 'gearchiveerd' ? (
            <ActionForm action={setFeaturedAction} aria-label="Uitgelicht">
              <input type="hidden" name="vehicleId" value={v.id} />
              <SubmitButton name="featured" value={v.featured ? 'nee' : 'ja'} variant="ghost">
                {v.featured ? 'Niet meer uitlichten' : 'Uitlichten op de website'}
              </SubmitButton>
              <FormMessage />
            </ActionForm>
          ) : null}
          {can(user.role, 'wagenpark:archiveren') ? (
            <ActionForm action={deleteVehicleAction} aria-label="Verwijderen">
              <input type="hidden" name="vehicleId" value={v.id} />
              <ConfirmSubmit
                label="Verwijderen"
                title="Auto definitief verwijderen?"
                description="Kan alleen als er nooit aanvragen voor deze auto zijn geweest. Foto’s worden ook verwijderd. Gebruik anders Archiveren."
                confirmLabel="Definitief verwijderen"
                name="bevestig"
                value="ja"
              />
              <FormMessage />
            </ActionForm>
          ) : null}
        </div>
      </section>

      <nav className="adm-tabs" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link key={t.key} href={`/beheer/wagenpark/${v.id}?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'algemeen' ? (
        <section className="adm-panel" style={{ maxWidth: '56rem' }}>
          <ActionForm action={updateGeneralAction} className="adm-form" aria-label="Algemene gegevens">
            <input type="hidden" name="vehicleId" value={v.id} />
            <fieldset disabled={!canEdit} className="adm-form" style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="adm-form-grid">
                <div className="field is-wide">
                  <label className="field__label" htmlFor="name">
                    Naam op de website
                  </label>
                  <input className="input" id="name" name="name" defaultValue={v.name} maxLength={80} />
                  <FieldError name="name" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="brand">
                    Merk
                  </label>
                  <input className="input" id="brand" name="brand" defaultValue={v.brand} maxLength={40} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="model">
                    Model
                  </label>
                  <input className="input" id="model" name="model" defaultValue={v.model} maxLength={60} />
                  <FieldError name="model" />
                </div>
                <div className="field is-wide">
                  <label className="field__label" htmlFor="edition">
                    Editie of uitvoering <span className="field__optional">(optioneel)</span>
                  </label>
                  <input className="input" id="edition" name="edition" defaultValue={v.edition ?? ''} maxLength={60} />
                </div>
                <div className="field is-wide">
                  <label className="field__label" htmlFor="tagline">
                    Korte omschrijving (kaart)
                  </label>
                  <CharCount id="tagline" name="tagline" defaultValue={v.tagline} max={90} />
                  <FieldError name="tagline" />
                </div>
                <div className="field is-wide">
                  <label className="field__label" htmlFor="description">
                    Beschrijving (voertuigpagina)
                  </label>
                  <CharCount id="description" name="description" defaultValue={v.description} max={1200} rows={7} />
                  <p className="field__hint">Een lege regel begint een nieuwe alinea. Noem geen cijfers die bij specificaties horen.</p>
                  <FieldError name="description" />
                </div>
                <div className="field is-wide">
                  <label className="field__label" htmlFor="highlights">
                    Kenmerken van de uitvoering (één per regel)
                  </label>
                  <textarea className="textarea" id="highlights" name="highlights" rows={5} defaultValue={v.highlights.join('\n')} />
                  <FieldError name="highlights" />
                </div>
              </div>
              {confirmBox('confirm', 'uitvoering')}
              <FormMessage />
              {canEdit ? (
                <div className="adm-form-actions">
                  <SubmitButton>Opslaan</SubmitButton>
                </div>
              ) : null}
            </fieldset>
          </ActionForm>
        </section>
      ) : null}

      {tab === 'specificaties' ? (
        <section className="adm-panel" style={{ maxWidth: '56rem' }}>
          <ActionForm action={updateSpecsAction} className="adm-form" aria-label="Specificaties en voorwaarden">
            <input type="hidden" name="vehicleId" value={v.id} />
            <fieldset disabled={!canEdit} className="adm-form" style={{ border: 0, padding: 0, margin: 0 }}>
              <h2 className="adm-section-title">Technische gegevens</h2>
              <div className="adm-form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="powerHp">
                    Vermogen (pk)
                  </label>
                  <input className="input" id="powerHp" name="powerHp" inputMode="numeric" defaultValue={v.powerHp ?? ''} />
                  <FieldError name="powerHp" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="torqueNm">
                    Koppel (Nm)
                  </label>
                  <input className="input" id="torqueNm" name="torqueNm" inputMode="numeric" defaultValue={v.torqueNm ?? ''} />
                  <FieldError name="torqueNm" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="accel">
                    0–100 km/u (seconden)
                  </label>
                  <input className="input" id="accel" name="accel" inputMode="decimal" defaultValue={v.accelTenths ? formatTenths(v.accelTenths) : ''} />
                  <FieldError name="accel" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="transmission">
                    Transmissie
                  </label>
                  <input className="input" id="transmission" name="transmission" defaultValue={v.transmission ?? ''} maxLength={40} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="modelYear">
                    Bouwjaar
                  </label>
                  <input className="input" id="modelYear" name="modelYear" inputMode="numeric" defaultValue={v.modelYear ?? ''} />
                  <FieldError name="modelYear" />
                </div>
              </div>
              {canConfirm ? (
                <label className="adm-check">
                  <input type="checkbox" name="confirmSpecs" defaultChecked={confirmed.has('specificaties')} />
                  <span>Ik bevestig dat de technische gegevens kloppen</span>
                </label>
              ) : null}
              <h2 className="adm-section-title">Voorwaarden</h2>
              <div className="adm-form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="minAge">
                    Minimumleeftijd
                  </label>
                  <input className="input" id="minAge" name="minAge" inputMode="numeric" defaultValue={v.minAge ?? ''} />
                  <FieldError name="minAge" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="mileagePolicy">
                    Kilometerregeling
                  </label>
                  <input className="input" id="mileagePolicy" name="mileagePolicy" defaultValue={v.mileagePolicy ?? ''} maxLength={80} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="plateCountry">
                    Kenteken (land)
                  </label>
                  <input className="input" id="plateCountry" name="plateCountry" defaultValue={v.plateCountry ?? ''} maxLength={40} />
                </div>
              </div>
              {canConfirm ? (
                <label className="adm-check">
                  <input type="checkbox" name="confirmTerms" defaultChecked={confirmed.has('voorwaarden')} />
                  <span>Ik bevestig dat de voorwaarden kloppen</span>
                </label>
              ) : (
                <p className="adm-small">
                  <Info size={14} /> Wijzigen trekt een eerdere bevestiging in; de eigenaar bevestigt opnieuw.
                </p>
              )}
              <FormMessage />
              {canEdit ? (
                <div className="adm-form-actions">
                  <SubmitButton>Opslaan</SubmitButton>
                </div>
              ) : null}
            </fieldset>
          </ActionForm>
        </section>
      ) : null}

      {tab === 'prijzen' ? (
        canPrice ? (
          <section className="adm-panel" style={{ maxWidth: '56rem' }}>
            <ActionForm action={updatePricingAction} className="adm-form" aria-label="Prijzen">
              <input type="hidden" name="vehicleId" value={v.id} />
              <p className="adm-muted">
                Bedragen in euro’s. Laat een veld leeg als het niet van toepassing is. Weekend- en weektarief en aanvullende kosten worden pas
                gebruikt als ze bevestigd zijn én de tariefregels in de publicatiecheck zijn bevestigd.
              </p>
              <div className="adm-form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="dayRate">
                    Dagprijs
                  </label>
                  <input className="input" id="dayRate" name="dayRate" inputMode="decimal" defaultValue={centsToInput(v.dayRateCents)} />
                  <FieldError name="dayRate" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="deposit">
                    Borg
                  </label>
                  <input className="input" id="deposit" name="deposit" inputMode="decimal" defaultValue={centsToInput(v.depositCents)} />
                  <FieldError name="deposit" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="weekendRate">
                    Weekendtarief per dag <span className="field__optional">(optioneel)</span>
                  </label>
                  <input className="input" id="weekendRate" name="weekendRate" inputMode="decimal" defaultValue={centsToInput(v.weekendRateCents)} />
                  <FieldError name="weekendRate" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="weekRate">
                    Weektarief (7 dagen) <span className="field__optional">(optioneel)</span>
                  </label>
                  <input className="input" id="weekRate" name="weekRate" inputMode="decimal" defaultValue={centsToInput(v.weekRateCents)} />
                  <FieldError name="weekRate" />
                </div>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="adm-section-title" style={{ marginBottom: '0.5rem' }}>
                  Aanvullende kosten <span className="field__optional">(optioneel)</span>
                </legend>
                {[...v.extraCosts, null, null].map((c, i) => (
                  <div className="adm-form-grid" key={i} style={{ marginBottom: '0.5rem' }}>
                    <div className="field">
                      <label className="field__label" htmlFor={`el-${i}`}>
                        Omschrijving
                      </label>
                      <input className="input" id={`el-${i}`} name="extraLabel" defaultValue={c?.label ?? ''} maxLength={60} />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`ea-${i}`}>
                        Bedrag
                      </label>
                      <input className="input" id={`ea-${i}`} name="extraAmount" inputMode="decimal" defaultValue={c ? centsToInput(c.amountCents) : ''} />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`eu-${i}`}>
                        Per
                      </label>
                      <select className="select" id={`eu-${i}`} name="extraUnit" defaultValue={c?.unit ?? 'per_huur'}>
                        <option value="per_huur">Per huur</option>
                        <option value="per_dag">Per dag</option>
                      </select>
                    </div>
                  </div>
                ))}
                <FieldError name="extraCosts" />
              </fieldset>
              <div>
                <label className="adm-check">
                  <input type="checkbox" name="confirmDay" defaultChecked={confirmed.has('dagprijs')} />
                  <span>Dagprijs bevestigd</span>
                </label>
                <label className="adm-check">
                  <input type="checkbox" name="confirmDeposit" defaultChecked={confirmed.has('borg')} />
                  <span>Borg bevestigd</span>
                </label>
                <label className="adm-check">
                  <input type="checkbox" name="confirmRules" defaultChecked={confirmed.has('tariefregels')} />
                  <span>Weekend-, weektarief en aanvullende kosten bevestigd</span>
                </label>
              </div>
              <FormMessage />
              <div className="adm-form-actions">
                <SubmitButton>Prijzen opslaan</SubmitButton>
              </div>
            </ActionForm>
          </section>
        ) : (
          <div className="adm-callout">
            <Info size={18} />
            <p>Alleen de eigenaar kan prijzen, borg en acties wijzigen.</p>
          </div>
        )
      ) : null}

      {tab === 'fotos' ? <PhotoManager vehicleId={v.id} photos={photos} canEdit={can(user.role, 'media:beheren')} uploadLimit={uploadLimitBytes()} /> : null}

      {tab === 'seo' ? (
        <section className="adm-panel" style={{ maxWidth: '56rem' }}>
          <ActionForm action={updateSeoAction} className="adm-form" aria-label="URL en vindbaarheid">
            <input type="hidden" name="vehicleId" value={v.id} />
            <fieldset disabled={!canEdit} className="adm-form" style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="field">
                <label className="field__label" htmlFor="slug">
                  Slug (adres van de pagina)
                </label>
                <input className="input" id="slug" name="slug" defaultValue={v.slug} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                <p className="field__hint">Wordt /wagenpark/{v.slug}. Een wijziging breekt bestaande links naar deze auto.</p>
                <FieldError name="slug" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="seoTitle">
                  SEO-titel
                </label>
                <CharCount id="seoTitle" name="seoTitle" defaultValue={v.seoTitle ?? ''} max={70} placeholder={`${v.name} huren in Den Haag`} />
                <FieldError name="seoTitle" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="seoDescription">
                  SEO-omschrijving
                </label>
                <CharCount id="seoDescription" name="seoDescription" defaultValue={v.seoDescription ?? ''} max={160} rows={3} />
                <FieldError name="seoDescription" />
              </div>
              <FormMessage />
              {canEdit ? (
                <div className="adm-form-actions">
                  <SubmitButton>Opslaan</SubmitButton>
                </div>
              ) : null}
            </fieldset>
          </ActionForm>
        </section>
      ) : null}

      {tab === 'brongegevens' ? (
        <div className="adm-grid">
          <div className="adm-callout">
            <Info size={18} />
            <div>
              <p>
                Prijzen, borg, specificaties en voorwaarden komen uit een eerdere opgave van een tussenpersoon. Zolang ze niet bevestigd zijn,
                toont de website ze in conceptmodus als indicatie en verbergt ze ze zodra de site live staat.
              </p>
              {v.sourceUrl ? (
                <p className="adm-small" style={{ marginTop: '0.5rem' }}>
                  Bron: <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">{v.sourceUrl}</a>
                  {v.sourceNote ? ` · ${v.sourceNote}` : ''}
                </p>
              ) : null}
            </div>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table adm-table--cards">
              <thead>
                <tr>
                  <th scope="col">Gegeven</th>
                  <th scope="col">Wat bevestig je</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actie</th>
                </tr>
              </thead>
              <tbody>
                {VERIFICATION_FIELDS.map((f) => {
                  const c = confirmed.get(f.field)
                  return (
                    <tr key={f.field}>
                      <td data-label="Gegeven">
                        <strong>{f.label}</strong>
                      </td>
                      <td data-label="Wat">{f.hint}</td>
                      <td data-label="Status">
                        {c ? (
                          <span className="adm-badge tone-ok">
                            <Check size={12} /> Bevestigd{c.by ? ` door ${c.by}` : ''} · {formatDateTimeShort(c.confirmedAt)}
                          </span>
                        ) : (
                          <span className="adm-badge tone-warn">
                            <Alert size={12} /> Onbevestigd
                          </span>
                        )}
                      </td>
                      <td data-label="Actie">
                        {canConfirm ? (
                          <ActionForm action={setVerificationAction} aria-label={`${f.label} bevestigen`}>
                            <input type="hidden" name="vehicleId" value={v.id} />
                            <SubmitButton name="veld" value={`${f.field}:${c ? 'nee' : 'ja'}`} variant={c ? 'ghost' : 'secondary'}>
                              {c ? 'Intrekken' : 'Bevestigen'}
                            </SubmitButton>
                            <FormMessage />
                          </ActionForm>
                        ) : (
                          <span className="adm-small">Alleen eigenaar</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'historie' ? (
        <div className="adm-grid adm-grid--2">
          <section className="adm-panel" aria-labelledby="rev-titel">
            <h2 id="rev-titel" className="adm-section-title">
              Eerdere versies
            </h2>
            <p className="adm-small">Herstellen zet tekst, specificaties en (voor de eigenaar) prijzen terug. Foto’s en status blijven ongewijzigd.</p>
            {revs.length ? (
              <ul className="adm-list">
                {revs.map((r) => (
                  <li key={r.id}>
                    <div>
                      <p>{r.summary || 'Versie'}</p>
                      <p className="adm-small">
                        {r.by ?? 'Systeem'} · {formatDateTimeShort(r.createdAt)}
                      </p>
                    </div>
                    {canEdit ? (
                      <ActionForm action={restoreRevisionAction} aria-label="Versie herstellen">
                        <input type="hidden" name="vehicleId" value={v.id} />
                        <input type="hidden" name="revisionId" value={r.id} />
                        <ConfirmSubmit
                          label="Herstellen"
                          title="Deze versie herstellen?"
                          description="De huidige gegevens worden eerst als versie bewaard. Herstelde gegevens moeten opnieuw worden bevestigd."
                          confirmLabel="Herstellen"
                          name="bevestig"
                          value={r.id}
                          variant="secondary"
                        />
                        <FormMessage />
                      </ActionForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-small">Nog geen eerdere versies.</p>
            )}
          </section>
          <section className="adm-panel" aria-labelledby="audit-titel">
            <h2 id="audit-titel" className="adm-section-title">
              Wijzigingen
            </h2>
            <ol className="adm-timeline">
              {audits.map((a) => (
                <li key={a.id}>
                  <strong>{a.summary}</strong>
                  {a.changes
                    ? Object.entries(a.changes).map(([field, ch]) => (
                        <span key={field} className="adm-small">
                          {field}: {JSON.stringify(ch.van)} → {JSON.stringify(ch.naar)}
                        </span>
                      ))
                    : null}
                  <span className="adm-small">
                    {a.by ?? 'Systeem'} · {formatDateTimeShort(a.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </>
  )
}
