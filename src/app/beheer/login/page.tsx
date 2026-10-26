import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/session'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Inloggen' }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/beheer')
  return (
    <main className="adm-login">
      <div className="adm-login__card">
        <div>
          <p className="adm-brand">
            Goed Geregeld <span>Beheer</span>
          </p>
          <h1 className="adm-title" style={{ marginTop: '1rem' }}>
            Inloggen
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
