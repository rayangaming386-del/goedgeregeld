import { AdminShell, type AdminNavItem } from '@/components/admin/AdminShell'
import { can, ROLE_LABELS, type Permission } from '@/domain/permissions'
import { newRequestCount } from '@/server/admin/queries'
import { requireUser } from '@/server/auth/session'
import { getSetting } from '@/server/content/settings'
import { ChangePasswordForm } from './account/ChangePasswordForm'

const NAV: Array<AdminNavItem & { permission: Permission }> = [
  { href: '/beheer', label: 'Dashboard', permission: 'dashboard:bekijken' },
  { href: '/beheer/aanvragen', label: 'Aanvragen', permission: 'aanvragen:bekijken' },
  { href: '/beheer/kalender', label: 'Kalender', permission: 'aanvragen:bekijken' },
  { href: '/beheer/wagenpark', label: 'Wagenpark', permission: 'wagenpark:bekijken' },
  { href: '/beheer/acties', label: 'Acties', permission: 'acties:beheren' },
  { href: '/beheer/inhoud', label: 'Website-inhoud', permission: 'inhoud:beheren' },
  { href: '/beheer/publicatie', label: 'Publicatiecheck', permission: 'dashboard:bekijken' },
  { href: '/beheer/gebruikers', label: 'Gebruikers', permission: 'gebruikers:beheren' },
  { href: '/beheer/geschiedenis', label: 'Wijzigingsgeschiedenis', permission: 'geschiedenis:bekijken' },
  { href: '/beheer/account', label: 'Mijn account', permission: 'dashboard:bekijken' },
]

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [publication, newCount] = await Promise.all([
    getSetting('publication'),
    can(user.role, 'aanvragen:bekijken') ? newRequestCount() : Promise.resolve(0),
  ])
  const nav = NAV.filter((item) => can(user.role, item.permission)).map(({ permission: _p, ...item }) =>
    item.href === '/beheer/aanvragen' ? { ...item, badge: newCount } : item,
  )
  return (
    <AdminShell nav={nav} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} conceptMode={publication.mode === 'concept'}>
      {user.mustChangePassword ? (
        <div style={{ maxWidth: '32rem' }}>
          <h1 className="adm-title">Kies een eigen wachtwoord</h1>
          <p className="adm-lead">Je bent ingelogd met een tijdelijk wachtwoord. Kies eerst een eigen wachtwoord van minimaal 12 tekens.</p>
          <div className="adm-panel" style={{ marginTop: '1.5rem' }}>
            <ChangePasswordForm />
          </div>
        </div>
      ) : (
        children
      )}
    </AdminShell>
  )
}
