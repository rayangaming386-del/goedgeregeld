import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/PageHeader'
import { Check } from '@/components/icons'
import { PERMISSION_LABELS, permissionsFor, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/domain/permissions'
import { requireUser } from '@/server/auth/session'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata: Metadata = { title: 'Mijn account' }

export default async function AccountPage({ searchParams }: PageProps<'/beheer/account'>) {
  const user = await requireUser()
  const sp = await searchParams
  return (
    <>
      <PageHeader title="Mijn account" description={`${user.name} · ${user.email}`} />
      {sp.gewijzigd === '1' ? (
        <p className="adm-message is-ok" role="status" style={{ marginBottom: '1rem' }}>
          <Check size={16} />
          <span>Je eigen wachtwoord is ingesteld. Je hebt nu toegang tot het beheer.</span>
        </p>
      ) : null}
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
          <ul className="adm-rights-list" aria-label="Rechten">
            {permissionsFor(user.role).map((p) => (
              <li key={p}>
                <Check size={14} />
                {PERMISSION_LABELS[p]}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
