import { asc, desc, eq, ne } from 'drizzle-orm'
import type { Metadata } from 'next'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { EmptyState, NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Check, Clock, Info } from '@/components/icons'
import { can } from '@/domain/permissions'
import { formatDateTimeShort, toLocalInputValues } from '@/domain/time'
import { centsToInput, formatEuro } from '@/lib/format'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { promotions, promotionVehicles, vehicles, type Promotion } from '@/server/db/schema'
import { deletePromotionAction, savePromotionAction } from './actions'

export const metadata: Metadata = { title: 'Acties' }

type VehicleOpt = { id: string; name: string; day: number | null }

function stateOf(p: Promotion, now: Date) {
  if (p.status === 'concept') return { label: 'Concept', tone: 'tone-info', icon: <Info size={12} /> }
  if (p.endsAt.getTime() <= now.getTime()) return { label: 'Verlopen', tone: 'tone-muted', icon: <Clock size={12} /> }
  if (p.startsAt.getTime() > now.getTime()) return { label: 'Gepland', tone: 'tone-warn', icon: <Clock size={12} /> }
  return { label: 'Actief', tone: 'tone-ok', icon: <Check size={12} /> }
}

function PromotionForm({ promo, vehicleIds, options }: { promo?: Promotion; vehicleIds: string[]; options: VehicleOpt[] }) {
  const now = new Date()
  const start = toLocalInputValues(promo?.startsAt ?? now)
  const end = toLocalInputValues(promo?.endsAt ?? new Date(now.getTime() + 14 * 86_400_000))
  const key = promo?.id ?? 'nieuw'
  return (
    <ActionForm action={savePromotionAction} className="adm-form" resetOnSuccess={!promo} aria-label={promo ? `Actie ${promo.title} bewerken` : 'Nieuwe actie'}>
      {promo ? <input type="hidden" name="promotionId" value={promo.id} /> : null}
      <div className="adm-form-grid">
        <div className="field is-wide">
          <label className="field__label" htmlFor={`title-${key}`}>
            Titel (zichtbaar op de website)
          </label>
          <input className="input" id={`title-${key}`} name="title" maxLength={60} defaultValue={promo?.title ?? ''} placeholder="Bijv. Winteractie" />
          <FieldError name="title" />
        </div>
        <div className="field is-wide">
          <label className="field__label" htmlFor={`desc-${key}`}>
            Toelichting <span className="field__optional">(optioneel, intern)</span>
          </label>
          <input className="input" id={`desc-${key}`} name="description" maxLength={160} defaultValue={promo?.description ?? ''} />
          <FieldError name="description" />
        </div>
        <fieldset className="field is-wide" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Auto’s</legend>
          <div className="adm-chips">
            {options.map((v) => (
              <label key={v.id} className="adm-check" style={{ paddingTop: 0, minHeight: '2.5rem', alignItems: 'center' }}>
                <input type="checkbox" name="vehicleIds" value={v.id} defaultChecked={vehicleIds.includes(v.id)} />
                <span>
                  {v.name} {v.day !== null ? <span className="adm-small">({formatEuro(v.day)})</span> : null}
                </span>
              </label>
            ))}
          </div>
          <FieldError name="vehicleIds" />
        </fieldset>
        <div className="field">
          <label className="field__label" htmlFor={`kind-${key}`}>
            Soort
          </label>
          <select className="select" id={`kind-${key}`} name="kind" defaultValue={promo?.kind ?? 'vaste_dagprijs'}>
            <option value="vaste_dagprijs">Actieprijs per dag</option>
            <option value="percentage">Korting in procenten</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`value-${key}`}>
            Actieprijs (€) of percentage (%)
          </label>
          <input
            className="input"
            id={`value-${key}`}
            name="value"
            inputMode="decimal"
            defaultValue={promo ? (promo.kind === 'percentage' ? String(promo.value) : centsToInput(promo.value)) : ''}
          />
          <FieldError name="value" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`sd-${key}`}>
            Geldig vanaf
          </label>
          <input className="input" type="date" id={`sd-${key}`} name="startDate" defaultValue={start.date} />
          <FieldError name="startDate" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`st-${key}`}>
            Om
          </label>
          <input className="input" type="time" id={`st-${key}`} name="startTime" step={900} defaultValue={promo ? start.time : '00:00'} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`ed-${key}`}>
            Geldig tot
          </label>
          <input className="input" type="date" id={`ed-${key}`} name="endDate" defaultValue={end.date} />
          <FieldError name="endDate" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`et-${key}`}>
            Om
          </label>
          <input className="input" type="time" id={`et-${key}`} name="endTime" step={900} defaultValue={promo ? end.time : '23:59'} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`status-${key}`}>
            Status
          </label>
          <select className="select" id={`status-${key}`} name="status" defaultValue={promo?.status ?? 'concept'}>
            <option value="concept">Concept (niet zichtbaar)</option>
            <option value="gepubliceerd">Live</option>
          </select>
        </div>
      </div>
      <p className="adm-small">
        Een actie geldt voor huurdagen binnen de periode en verdwijnt automatisch van de website na de einddatum. Live acties voor dezelfde auto
        mogen elkaar niet overlappen.
      </p>
      <FormMessage />
      <div className="adm-form-actions">
        <SubmitButton>{promo ? 'Actie opslaan' : 'Actie aanmaken'}</SubmitButton>
      </div>
    </ActionForm>
  )
}

export default async function PromotionsPage() {
  const user = await requireUser()
  if (!can(user.role, 'acties:beheren')) return <NoAccess />
  const db = getDb()
  const [list, links, opts] = await Promise.all([
    db.select().from(promotions).orderBy(desc(promotions.endsAt)),
    db.select().from(promotionVehicles),
    db.select({ id: vehicles.id, name: vehicles.name, day: vehicles.dayRateCents }).from(vehicles).where(ne(vehicles.status, 'gearchiveerd')).orderBy(asc(vehicles.sortOrder)),
  ])
  const now = new Date()
  const nameOf = new Map(opts.map((o) => [o.id, o.name]))
  return (
    <>
      <PageHeader title="Acties" description="Tijdelijke actieprijzen of kortingen per auto. Concept-acties zijn niet zichtbaar op de website." />
      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="nieuwe-actie">
          <h2 id="nieuwe-actie" className="adm-section-title">
            Nieuwe actie
          </h2>
          <PromotionForm vehicleIds={[]} options={opts} />
        </section>

        <section aria-labelledby="alle-acties" className="adm-grid">
          <h2 id="alle-acties" className="adm-section-title">
            Alle acties
          </h2>
          {list.length === 0 ? <EmptyState title="Nog geen acties" /> : null}
          {list.map((p) => {
            const state = stateOf(p, now)
            const ids = links.filter((l) => l.promotionId === p.id).map((l) => l.vehicleId)
            return (
              <article key={p.id} className="adm-panel">
                <div className="adm-panel__head">
                  <h3 className="adm-section-title">{p.title}</h3>
                  <span className={`adm-badge ${state.tone}`}>
                    {state.icon}
                    {state.label}
                  </span>
                </div>
                <p className="adm-small">
                  {p.kind === 'percentage' ? `${p.value}% korting` : `${formatEuro(p.value)} per dag`} · {formatDateTimeShort(p.startsAt)} tot{' '}
                  {formatDateTimeShort(p.endsAt)} · {ids.map((id) => nameOf.get(id) ?? 'gearchiveerde auto').join(', ') || 'geen auto’s'}
                </p>
                <details>
                  <summary className="btn btn--ghost btn--sm">Bewerken</summary>
                  <div style={{ marginTop: '1rem' }}>
                    <PromotionForm promo={p} vehicleIds={ids} options={opts} />
                  </div>
                </details>
                <ActionForm action={deletePromotionAction} aria-label={`Actie ${p.title} verwijderen`}>
                  <input type="hidden" name="promotionId" value={p.id} />
                  <ConfirmSubmit label="Verwijderen" title="Actie verwijderen?" description="De actie verdwijnt direct van de website." confirmLabel="Verwijderen" name="bevestig" value={p.id} />
                  <FormMessage />
                </ActionForm>
              </article>
            )
          })}
        </section>
      </div>
    </>
  )
}
