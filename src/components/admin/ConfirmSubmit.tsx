'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * Verzendknop met bevestiging in een native dialog (toegankelijk, Escape sluit).
 * Gebruik binnen een <form>.
 */
export function ConfirmSubmit({
  label,
  title,
  description,
  confirmLabel,
  name,
  value,
  variant = 'danger',
}: {
  label: string
  title: string
  description: string
  confirmLabel: string
  name?: string
  value?: string
  variant?: 'danger' | 'secondary'
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pending } = useFormStatus()
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn--sm btn--secondary ${variant === 'danger' ? 'adm-danger' : ''}`}
        onClick={() => dialogRef.current?.showModal()}
        disabled={pending}
      >
        {label}
      </button>
      <dialog ref={dialogRef} className="adm-dialog" aria-labelledby={`${name ?? 'bevestig'}-${value ?? ''}-titel`}>
        <h2 id={`${name ?? 'bevestig'}-${value ?? ''}-titel`} className="adm-dialog__title">
          {title}
        </h2>
        <p className="adm-dialog__text">{description}</p>
        <div className="adm-dialog__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => dialogRef.current?.close()}>
            Terug
          </button>
          <button
            type="submit"
            name={name}
            value={value}
            className={`btn btn--sm ${variant === 'danger' ? 'btn--secondary adm-danger' : 'btn--primary'}`}
            onClick={() => dialogRef.current?.close()}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  )
}
