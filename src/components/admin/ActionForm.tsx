'use client'

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, Check } from '@/components/icons'
import { INITIAL_STATE, type ActionState } from './action-state'

const StateContext = createContext<ActionState>(INITIAL_STATE)

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  className?: string
  /** Na succes de velden leegmaken (voor “toevoegen”-formulieren). */
  resetOnSuccess?: boolean
  id?: string
  'aria-label'?: string
}

/**
 * Formulier voor Server Actions. Voorkomt dat React de velden na een mislukte
 * validatie leegmaakt (geen automatische form-reset) en toont meldingen.
 * Werkt zonder JavaScript via het action-attribuut.
 */
export function ActionForm({ action, children, className, resetOnSuccess, id, ...rest }: Props) {
  const [state, formAction] = useActionState(action, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (resetOnSuccess && state.ok && state.at) formRef.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <StateContext.Provider value={state}>
      <form
        ref={formRef}
        id={id}
        className={className}
        action={formAction}
        aria-label={rest['aria-label']}
        onSubmit={(e) => {
          e.preventDefault()
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
          const fd = new FormData(e.currentTarget, submitter)
          startTransition(() => formAction(fd))
        }}
        noValidate
      >
        {children}
      </form>
    </StateContext.Provider>
  )
}

export function useActionFormState() {
  return useContext(StateContext)
}

export function FieldError({ name }: { name: string }) {
  const state = useContext(StateContext)
  const msg = state.errors?.[name]
  if (!msg) return null
  return (
    <p className="field__error" id={`fout-${name}`}>
      <Alert size={16} />
      <span>{msg}</span>
    </p>
  )
}

export function FormMessage() {
  const state = useContext(StateContext)
  if (!state.message) return null
  return (
    <p className={`adm-message ${state.ok ? 'is-ok' : 'is-error'}`} role={state.ok ? 'status' : 'alert'} key={state.at}>
      {state.ok ? <Check size={16} /> : <Alert size={16} />}
      <span>{state.message}</span>
    </p>
  )
}

/** Toont een eenmalig gegeven (tijdelijk wachtwoord) met kopieerknop. */
export function SecretNotice() {
  const state = useContext(StateContext)
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [state.at])
  if (!state.ok || !state.secret) return null
  const { label, value } = state.secret
  return (
    <div className="adm-secret" role="status">
      <p className="adm-small">{label}</p>
      <div className="adm-secret__row">
        <code className="adm-secret__value">{value}</code>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Gekopieerd' : 'Kopiëren'}
        </button>
      </div>
      <p className="adm-small">
        Dit wachtwoord wordt maar één keer getoond en nergens bewaard. Geef het persoonlijk of via een beveiligd kanaal door; bij de eerste
        login moet een eigen wachtwoord worden gekozen.
      </p>
    </div>
  )
}

export function SubmitButton({
  children,
  variant = 'primary',
  name,
  value,
  pendingText = 'Bezig…',
  className = '',
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  name?: string
  value?: string
  pendingText?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`btn btn--sm ${variant === 'danger' ? 'btn--secondary adm-danger' : `btn--${variant}`} ${className}`}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingText : children}
    </button>
  )
}
