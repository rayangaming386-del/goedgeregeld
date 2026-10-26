'use client'

import { ActionForm, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { login } from '../auth-actions'

export function LoginForm() {
  return (
    <ActionForm action={login} className="adm-form" aria-label="Inloggen">
      <div className="field">
        <label className="field__label" htmlFor="email">
          E-mailadres
        </label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="password">
          Wachtwoord
        </label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage />
      <SubmitButton pendingText="Inloggen…">Inloggen</SubmitButton>
    </ActionForm>
  )
}
