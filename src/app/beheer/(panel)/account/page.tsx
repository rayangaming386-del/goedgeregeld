import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/PageHeader'
import { permissionsFor, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/domain/permissions'
import { requireUser } from '@/server/auth/session'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata: Metadata = { title: 'Mijn account' }

export default async function AccountPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader title="Mijn account" description={`${user.name} · ${user.email}`} />
      <div className="adm-grid adm-grid--2">
        <section className="adm-panel" aria-labelledby="ww-titel">
          <h2 id="ww-titel" className="adm-section-title">
            Wachtwoord wijzigen
          </h2>
          <ChangePasswordForm />
        </section>
        <section className="adm-panel" aria-labelledby="rol-titel">
          <h2 id="rol-titel" className="adm-section-title">
            Rol: {ROLE_LABELS[user.role]}
          </h2>
          <p className="adm-muted">{ROLE_DESCRIPTIONS[user.role]}</p>
          <ul className="adm-chips" aria-label="Rechten">
            {permissionsFor(user.role).map((p) => (
              <li key={p} className="chip">
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
