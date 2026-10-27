import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, Check, Info } from '@/components/icons'
import { SITE_CHECKS } from '@/domain/content'
import { can } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { requireUser } from '@/server/auth/session'
import { publicationReadiness, type CheckItem } from '@/server/publication/readiness'
import { VERIFICATION_FIELDS } from '@/server/vehicles/service'
import { VEHICLE_STATUS_LABELS } from '../wagenpark/labels'
import { pricingRulesAction, publicationAction, siteCheckAction } from './actions'

export const metadata: Metadata = { title: 'Publicatiecheck' }

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return ok ? (
    <span className="adm-check-icon is-ok">
      <Check size={14} />
      <span className="visually-hidden">In orde: </span>
    </span>
  ) : (
    <span className={`adm-check-icon ${warn ? 'is-warn' : 'is-open'}`}>
      <Alert size={14} />
      <span className="visually-hidden">{warn ? 'Let op: ' : 'Open: '}</span>
    </span>
  )
}

function CheckRow({ item, warn, action }: { item: CheckItem; warn?: boolean; action?: React.ReactNode }) {
  return (
    <li>
      <StatusIcon ok={item.ok} warn={warn} />
      <div className="adm-checklist__text">
        <strong>{item.label}</strong>
        <p className="adm-small">{item.detail}</p>
      </div>
      <div className="adm-checklist__action">
        {action}
        {!action && item.href && !item.ok ? (
          <Link href={item.href} className="btn btn--ghost btn--sm">
            Openen
          </Link>
        ) : null}
      </div>
    </li>
  )
}

export default async function PublicationPage() {
  const user = await requireUser()
  if (!can(user.role, 'dashboard:bekijken')) return <NoAccess />
  const r = await publicationReadiness()
  const canConfirm = can(user.role, 'brongegevens:bevestigen')
  const canPublish = can(user.role, 'instellingen:beheren')
  const open = r.blockers.filter((b) => !b.ok)
  const rules = r.content.pricingRules

  return (
    <>
      <PageHeader
        title="Publicatiecheck"
        description="Wat de eigenaar moet bevestigen voordat de website live gaat. Onbevestigde prijzen, borg, specificaties en voorwaarden verschijnen in concept als indicatie en worden op de live site verborgen."
      />

      <div className="adm-grid">
        <section className="adm-panel adm-publish" aria-labelledby="stand">
          <div className="adm-panel__head">
            <h2 id="stand" className="adm-section-title">
              Stand van de website
            </h2>
            <span className="adm-chips">
              {r.mode === 'live' ? (
                <span className="adm-badge tone-ok">
                  <Check size={12} /> Live
                </span>
              ) : (
                <span className="adm-badge tone-info">
                  <Info size={12} /> Concept
                </span>
              )}
              {r.indexable ? (
                <span className="adm-badge tone-ok">
                  <Check size={12} /> Vindbaar
                </span>
              ) : (
                <span className="adm-badge tone-muted">Niet vindbaar (noindex)</span>
              )}
            </span>
          </div>
          <p className="adm-small">
            {r.mode === 'live'
              ? 'De website toont alleen bevestigde gegevens. Auto’s zonder bevestigde fotorechten worden niet getoond.'
              : 'Conceptmodus: alles is zichtbaar met de markering “te bevestigen”, zoekmachines worden geweerd en de website toont een conceptlabel.'}{' '}
            Deze schakelaar bepaalt alleen wat de website laat zien; hij zet de website niet op een domein of bij een hostingpartij.
          </p>

          {canPublish ? (
            <ActionForm action={publicationAction} className="adm-chips" aria-label="Publicatie">
              {r.mode === 'concept' ? (
                r.canGoLive ? (
                  <ConfirmSubmit
                    label="Website live zetten"
                    title="Website live zetten?"
                    description="Onbevestigde gegevens worden direct verborgen en het conceptlabel verdwijnt. Zoekmachines blijven geweerd tot je de site apart vindbaar maakt."
                    confirmLabel="Live zetten"
                    name="intent"
                    value="live"
                    variant="secondary"
                  />
                ) : (
                  <p className="adm-note">
                    <Alert size={16} />
                    <span>
                      Live zetten kan zodra {open.length === 1 ? 'het open punt' : `de ${open.length} open punten`} onder “Verplicht vóór livegang” in
                      orde {open.length === 1 ? 'is' : 'zijn'}.
                    </span>
                  </p>
                )
              ) : (
                <>
                  <ConfirmSubmit
                    label="Terug naar concept"
                    title="Terug naar concept?"
                    description="De website toont weer alle gegevens met de markering “te bevestigen” en wordt niet geïndexeerd."
                    confirmLabel="Naar concept"
                    name="intent"
                    value="concept"
                    variant="secondary"
                  />
                  {r.indexable ? (
                    <SubmitButton name="intent" value="onvindbaar" variant="ghost">
                      Vindbaarheid uitzetten
                    </SubmitButton>
                  ) : r.siteUrl ? (
                    <ConfirmSubmit
                      label="Vindbaar maken"
                      title="Website vindbaar maken?"
                      description={`Zoekmachines mogen ${r.siteUrl} indexeren. De sitemap en canonieke adressen gebruiken dit domein.`}
                      confirmLabel="Vindbaar maken"
                      name="intent"
                      value="vindbaar"
                      variant="secondary"
                    />
                  ) : (
                    <p className="adm-small">Vindbaar maken kan pas als SITE_URL op het definitieve domein staat.</p>
                  )}
                </>
              )}
              <FormMessage />
            </ActionForm>
          ) : (
            <p className="adm-small">Alleen de eigenaar kan de website live zetten.</p>
          )}
        </section>

        <div className="adm-grid adm-grid--2">
          <section className="adm-panel" aria-labelledby="voorwaarden-live">
            <h2 id="voorwaarden-live" className="adm-section-title">
              Verplicht vóór livegang
            </h2>
            <ul className="adm-checklist">
              {r.blockers.map((b) => {
                const check = SITE_CHECKS.find((c) => `check-${c.key}` === b.id)
                const state = check ? r.content.siteChecks[check.key] : null
                return (
                  <CheckRow
                    key={b.id}
                    item={state?.confirmed && state.by ? { ...b, detail: `${b.detail} Bevestigd door ${state.by}${state.at ? `, ${formatDateTimeShort(new Date(state.at))}` : ''}.` } : b}
                    action={
                      check && canConfirm ? (
                        <ActionForm action={siteCheckAction} aria-label={`${check.label} bevestigen`}>
                          <SubmitButton name="controle" value={`${check.key}:${b.ok ? 'nee' : 'ja'}`} variant={b.ok ? 'ghost' : 'secondary'}>
                            {b.ok ? 'Intrekken' : 'Bevestigen'}
                          </SubmitButton>
                          <FormMessage />
                        </ActionForm>
                      ) : undefined
                    }
                  />
                )
              })}
            </ul>
          </section>

          <section className="adm-panel" aria-labelledby="aandacht">
            <h2 id="aandacht" className="adm-section-title">
              Aandachtspunten
            </h2>
            <ul className="adm-checklist">
              {r.warnings.map((w) => (
                <CheckRow key={w.id} item={w} warn />
              ))}
              <li>
                <StatusIcon ok={r.conceptFaqs === 0} warn />
                <div className="adm-checklist__text">
                  <strong>Veelgestelde vragen in concept</strong>
                  <p className="adm-small">
                    {r.conceptFaqs
                      ? `${r.conceptFaqs} ${r.conceptFaqs === 1 ? 'vraag wacht' : 'vragen wachten'} op een bevestigd antwoord en ${r.conceptFaqs === 1 ? 'is' : 'zijn'} niet zichtbaar.`
                      : 'Alle vragen zijn gepubliceerd.'}
                  </p>
                </div>
                <div className="adm-checklist__action">
                  {r.conceptFaqs ? (
                    <Link href="/beheer/inhoud?tab=faq" className="btn btn--ghost btn--sm">
                      Openen
                    </Link>
                  ) : null}
                </div>
              </li>
            </ul>
          </section>
        </div>

        <section className="adm-panel" aria-labelledby="per-auto">
          <h2 id="per-auto" className="adm-section-title">
            Brongegevens per auto
          </h2>
          <p className="adm-small">
            Prijzen, borg en specificaties komen uit een eerdere opgave en zijn nog niet door de eigenaar gecontroleerd. Bevestig per auto wat
            klopt; wat niet bevestigd is, toont de live site niet.
          </p>
          <ul className="adm-list adm-verify">
            {r.vehicles.map((v) => {
              const hiddenEntirely = v.status === 'gepubliceerd' && !v.confirmed.includes('fotos')
              return (
                <li key={v.id}>
                  <div className="adm-verify__head">
                    <div>
                      <Link href={`/beheer/wagenpark/${v.id}?tab=brongegevens`}>
                        <strong>{v.name}</strong>
                      </Link>
                      <p className="adm-small">
                        {VEHICLE_STATUS_LABELS[v.status]} · {v.publicPhotos} openbare foto’s
                      </p>
                    </div>
                    <Link href={`/beheer/wagenpark/${v.id}?tab=brongegevens`} className="btn btn--ghost btn--sm">
                      {canConfirm ? 'Controleren en bevestigen' : 'Bekijken'}
                    </Link>
                  </div>
                  <ul className="adm-chips" aria-label={`Bevestigingen voor ${v.name}`}>
                    {VERIFICATION_FIELDS.map((f) => {
                      const ok = v.confirmed.includes(f.field)
                      return (
                        <li key={f.field} className={`adm-badge ${ok ? 'tone-ok' : f.field === 'fotos' ? 'tone-danger' : 'tone-warn'}`}>
                          {ok ? <Check size={12} /> : <Alert size={12} />}
                          {f.label}
                          <span className="visually-hidden">{ok ? ': bevestigd' : ': nog niet bevestigd'}</span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="adm-small">
                    <span className="adm-verify__label">Op de live site verborgen: </span>
                    {hiddenEntirely ? <strong>de hele auto, tot de fotorechten zijn bevestigd</strong> : v.hiddenWhenLive.length ? v.hiddenWhenLive.join(', ') : 'niets'}
                  </p>
                </li>
              )
            })}
          </ul>
          {canConfirm ? (
            <p className="adm-small">Bevestigen doe je per auto onder Wagenpark → Brongegevens, zodat je de waarden naast de bron ziet.</p>
          ) : null}
        </section>

        <section className="adm-panel" aria-labelledby="rekenregels">
          <h2 id="rekenregels" className="adm-section-title">
            Rekenregels voor de prijsindicatie
          </h2>
          <p className="adm-small">
            De website rekent pas een totaalprijs uit als deze regels door de eigenaar zijn vastgelegd. Er worden geen weekendprijzen, toeslagen
            of kortingen verzonnen: alleen tarieven die per auto zijn ingevuld en bevestigd tellen mee.
          </p>
          {canPublish ? (
            <ActionForm action={pricingRulesAction} className="adm-form" aria-label="Rekenregels">
              <div className="adm-form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="r-dagen">
                    Hoe tellen huurdagen?
                  </label>
                  <select className="select" id="r-dagen" name="dayCounting" defaultValue={rules.dayCounting ?? ''}>
                    <option value="">Nog niet bekend</option>
                    <option value="per_24_uur">Per 24 uur (vr 10:00 – za 10:00 = 1 dag)</option>
                    <option value="per_kalenderdag">Per kalenderdag (vr 10:00 – za 10:00 = 2 dagen)</option>
                  </select>
                  <FieldError name="dayCounting" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="r-btw">
                    Zijn de prijzen inclusief btw?
                  </label>
                  <select className="select" id="r-btw" name="vat" defaultValue={rules.vat}>
                    <option value="onbekend">Nog niet bekend</option>
                    <option value="inclusief">Inclusief btw</option>
                    <option value="exclusief">Exclusief btw</option>
                  </select>
                  <FieldError name="vat" />
                </div>
              </div>
              <label className="adm-check">
                <input type="checkbox" name="confirmed" value="ja" defaultChecked={rules.confirmed} />
                <span>Ik bevestig dat deze regels kloppen en op de website gebruikt mogen worden.</span>
              </label>
              <FormMessage />
              <div className="adm-form-actions">
                <SubmitButton>Rekenregels opslaan</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <dl className="adm-dl">
              <div>
                <dt>Dagtelling</dt>
                <dd>{rules.dayCounting === 'per_24_uur' ? 'Per 24 uur' : rules.dayCounting === 'per_kalenderdag' ? 'Per kalenderdag' : 'Nog niet bekend'}</dd>
              </div>
              <div>
                <dt>Btw</dt>
                <dd>{rules.vat === 'inclusief' ? 'Inclusief' : rules.vat === 'exclusief' ? 'Exclusief' : 'Nog niet bekend'}</dd>
              </div>
              <div>
                <dt>Bevestigd</dt>
                <dd>{rules.confirmed ? 'Ja' : 'Nee'}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </>
  )
}
