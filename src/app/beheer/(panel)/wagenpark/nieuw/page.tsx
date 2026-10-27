import type { Metadata } from 'next'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { can } from '@/domain/permissions'
import { requireUser } from '@/server/auth/session'
import { createVehicleAction } from '../actions'

export const metadata: Metadata = { title: 'Auto toevoegen' }

export default async function NewVehiclePage() {
  const user = await requireUser()
  if (!can(user.role, 'wagenpark:bewerken')) return <NoAccess />
  return (
    <>
      <PageHeader title="Auto toevoegen" description="De auto wordt als concept opgeslagen en is pas zichtbaar na publiceren." />
      <section className="adm-panel" style={{ maxWidth: '40rem' }}>
        <ActionForm action={createVehicleAction} className="adm-form" aria-label="Auto toevoegen">
          <div className="adm-form-grid">
            <div className="field">
              <label className="field__label" htmlFor="brand">
                Merk
              </label>
              <input className="input" id="brand" name="brand" defaultValue="Audi" maxLength={40} />
              <FieldError name="brand" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="model">
                Model
              </label>
              <input className="input" id="model" name="model" placeholder="Bijv. RS6 Avant" maxLength={60} />
              <FieldError name="model" />
            </div>
            <div className="field is-wide">
              <label className="field__label" htmlFor="name">
                Naam op de website
              </label>
              <input className="input" id="name" name="name" placeholder="Bijv. Audi RS6 Avant" maxLength={80} />
              <FieldError name="name" />
            </div>
          </div>
          <FormMessage />
          <div className="adm-form-actions">
            <SubmitButton>Concept aanmaken</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  )
}
