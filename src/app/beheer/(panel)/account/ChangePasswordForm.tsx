'use client'

import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { changePassword } from '../../auth-actions'

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} className="adm-form" resetOnSuccess aria-label="Wachtwoord wijzigen">
      <div className="field">
        <label className="field__label" htmlFor="current">
          Huidig wachtwoord
        </label>
        <input className="input" id="current" name="current" type="password" autoComplete="current-password" aria-describedby="fout-current" />
        <FieldError name="current" />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="next">
          Nieuw wachtwoord
        </label>
        <input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={12} aria-describedby="hint-next fout-next" />
        <p className="field__hint" id="hint-next">
          Minimaal 12 tekens. Een zin van een paar woorden werkt goed.
        </p>
        <FieldError name="next" />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="repeat">
          Herhaal nieuw wachtwoord
        </label>
        <input className="input" id="repeat" name="repeat" type="password" autoComplete="new-password" aria-describedby="fout-repeat" />
        <FieldError name="repeat" />
      </div>
      <FormMessage />
      <div className="adm-form-actions">
        <SubmitButton>Wachtwoord opslaan</SubmitButton>
      </div>
    </ActionForm>
  )
}
