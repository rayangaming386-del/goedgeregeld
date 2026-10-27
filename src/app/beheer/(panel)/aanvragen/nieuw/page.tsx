import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { ArrowLeft } from '@/components/icons'
import { can } from '@/domain/permissions'
import { vehicleOptions } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'
import { createManualAction } from '../actions'

export const metadata: Metadata = { title: 'Aanvraag toevoegen' }

export default async function NewRequestPage() {
  const user = await requireUser()
  if (!can(user.role, 'aanvragen:beheren')) return <NoAccess />
  const vehicles = (await vehicleOptions()).filter((v) => v.status !== 'gearchiveerd')
  return (
    <>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/beheer/aanvragen" className="adm-small" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <ArrowLeft size={16} /> Alle aanvragen
        </Link>
      </p>
      <PageHeader
        title="Aanvraag of reservering toevoegen"
        description="Voor aanvragen die via WhatsApp, telefoon of Instagram binnenkomen. Kies “Bevestigd” alleen als de reservering definitief is afgesproken."
      />
      <section className="adm-panel" style={{ maxWidth: '56rem' }}>
        <ActionForm action={createManualAction} className="adm-form" aria-label="Aanvraag toevoegen">
          <div className="adm-form-grid">
            <div className="field is-wide">
              <label className="field__label" htmlFor="vehicleId">
                Auto
              </label>
              <select className="select" id="vehicleId" name="vehicleId" defaultValue="">
                <option value="" disabled>
                  Kies een auto
                </option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.status === 'concept' ? ' (concept)' : ''}
                  </option>
                ))}
              </select>
              <FieldError name="vehicleId" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="startDate">
                Begindatum
              </label>
              <input className="input" type="date" id="startDate" name="startDate" />
              <FieldError name="startDate" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="startTime">
                Begintijd
              </label>
              <input className="input" type="time" id="startTime" name="startTime" step={900} defaultValue="10:00" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="endDate">
                Einddatum
              </label>
              <input className="input" type="date" id="endDate" name="endDate" />
              <FieldError name="endDate" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="endTime">
                Eindtijd
              </label>
              <input className="input" type="time" id="endTime" name="endTime" step={900} defaultValue="10:00" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="name">
                Naam klant
              </label>
              <input className="input" id="name" name="name" maxLength={80} autoComplete="off" />
              <FieldError name="name" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="phone">
                Telefoon
              </label>
              <input className="input" id="phone" name="phone" type="tel" maxLength={24} autoComplete="off" />
              <FieldError name="phone" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="email">
                E-mail <span className="field__optional">(optioneel)</span>
              </label>
              <input className="input" id="email" name="email" type="email" maxLength={120} autoComplete="off" />
              <FieldError name="email" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="source">
                Bron
              </label>
              <select className="select" id="source" name="source" defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="telefoon">Telefoon</option>
                <option value="instagram">Instagram</option>
                <option value="handmatig">Anders / handmatig</option>
              </select>
              <FieldError name="source" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="status">
                Status
              </label>
              <select className="select" id="status" name="status" defaultValue="nieuw">
                <option value="nieuw">Nieuw (aanvraag)</option>
                <option value="in_behandeling">In behandeling</option>
                <option value="bevestigd">Bevestigd (reservering)</option>
              </select>
              <FieldError name="status" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="optionDate">
                Tijdelijke optie tot <span className="field__optional">(optioneel)</span>
              </label>
              <input className="input" type="date" id="optionDate" name="optionDate" />
              <FieldError name="optionDate" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="optionTime">
                Optie vervalt om
              </label>
              <input className="input" type="time" id="optionTime" name="optionTime" step={900} defaultValue="18:00" />
            </div>
            <div className="field is-wide">
              <label className="field__label" htmlFor="message">
                Bericht of afspraken <span className="field__optional">(optioneel)</span>
              </label>
              <textarea className="textarea" id="message" name="message" rows={3} maxLength={1000} />
            </div>
          </div>
          <FormMessage />
          <div className="adm-form-actions">
            <SubmitButton>Opslaan</SubmitButton>
            <Link href="/beheer/aanvragen" className="btn btn--ghost btn--sm">
              Annuleren
            </Link>
          </div>
        </ActionForm>
      </section>
    </>
  )
}
