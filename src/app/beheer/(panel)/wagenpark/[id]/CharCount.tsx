'use client'

import { useState } from 'react'

/** Invoerveld met live tekenteller; markeert overschrijding van de limiet. */
export function CharCount({
  id,
  name,
  defaultValue,
  max,
  rows,
  placeholder,
}: {
  id: string
  name: string
  defaultValue: string
  max: number
  rows?: number
  placeholder?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const over = value.length > max
  const counterId = `${id}-teller`
  return (
    <>
      {rows ? (
        <textarea
          className="textarea"
          id={id}
          name={name}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={counterId}
          aria-invalid={over ? true : undefined}
        />
      ) : (
        <input
          className="input"
          id={id}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={counterId}
          aria-invalid={over ? true : undefined}
        />
      )}
      <p id={counterId} className={`adm-counter ${over ? 'is-over' : ''}`} aria-live={over ? 'polite' : 'off'}>
        {value.length} / {max}
        {over ? ' — te lang' : ''}
      </p>
    </>
  )
}
