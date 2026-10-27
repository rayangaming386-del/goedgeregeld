'use client'

import { useState } from 'react'
import { FieldError } from '@/components/admin/ActionForm'
import styles from './editors.module.css'

export type MediaOption = { id: string; label: string; src: string; group: string }

/** Beeldkeuze uit de foto’s van het wagenpark, met voorvertoning en focuspunt. */
export function MediaSelect({
  name,
  options,
  defaultValue,
  focalX,
  focalY,
  aspect = '4 / 5',
  idPrefix,
  label = 'Beeld',
}: {
  name: string
  label?: string
  options: MediaOption[]
  defaultValue: string | null
  focalX?: number
  focalY?: number
  aspect?: string
  idPrefix: string
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [fx, setFx] = useState(focalX ?? 50)
  const [fy, setFy] = useState(focalY ?? 50)
  const selected = options.find((o) => o.id === value)
  const groups = [...new Set(options.map((o) => o.group))]
  const withFocal = focalX !== undefined
  return (
    <div className={styles.media}>
      <div className="field">
        <label className="field__label" htmlFor={`${idPrefix}-media`}>
          {label}
        </label>
        <select className="select" id={`${idPrefix}-media`} name={name} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Geen beeld</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {withFocal ? (
          <div className="adm-form-grid">
            <div className="field">
              <label className="field__label" htmlFor={`${idPrefix}-fx`}>
                Focus horizontaal (%)
              </label>
              <input className="input" type="number" min={0} max={100} id={`${idPrefix}-fx`} name="focalX" value={fx} onChange={(e) => setFx(Number(e.target.value))} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${idPrefix}-fy`}>
                Focus verticaal (%)
              </label>
              <input className="input" type="number" min={0} max={100} id={`${idPrefix}-fy`} name="focalY" value={fy} onChange={(e) => setFy(Number(e.target.value))} />
            </div>
          </div>
        ) : null}
      </div>
      {selected ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.preview}
          src={selected.src}
          alt=""
          style={{ aspectRatio: aspect, objectPosition: `${fx}% ${fy}%` }}
          onClick={(e) => {
            if (!withFocal) return
            const r = e.currentTarget.getBoundingClientRect()
            setFx(Math.round(((e.clientX - r.left) / r.width) * 100))
            setFy(Math.round(((e.clientY - r.top) / r.height) * 100))
          }}
        />
      ) : (
        <div className={styles.previewEmpty}>Geen beeld gekozen</div>
      )}
    </div>
  )
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <p className={`adm-counter ${value.length > max ? 'is-over' : ''}`}>
      {value.length} / {max}
    </p>
  )
}

/** Hero-tekst met live voorvertoning op telefoon- en desktopbreedte. */
export function HeroTextEditor({ headline, accent, intro }: { headline: string; accent: string; intro: string }) {
  const [h, setH] = useState(headline)
  const [a, setA] = useState(accent)
  const [i, setI] = useState(intro)
  return (
    <div className={styles.hero}>
      <div className="adm-form-grid">
        <div className="field">
          <label className="field__label" htmlFor="hero-headline">
            Kop
          </label>
          <input className="input" id="hero-headline" name="headline" value={h} onChange={(e) => setH(e.target.value)} />
          <Counter value={h} max={48} />
          <FieldError name="headline" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="hero-accent">
            Kop, deel in accentkleur
          </label>
          <input className="input" id="hero-accent" name="headlineAccent" value={a} onChange={(e) => setA(e.target.value)} />
          <Counter value={a} max={36} />
          <FieldError name="headlineAccent" />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="hero-intro">
          Introductie
        </label>
        <textarea className="textarea" id="hero-intro" name="intro" rows={3} value={i} onChange={(e) => setI(e.target.value)} />
        <Counter value={i} max={240} />
        <FieldError name="intro" />
      </div>
      <div className={styles.previews} aria-label="Voorvertoning">
        <figure>
          <figcaption className="adm-small">Telefoon (390 px)</figcaption>
          <div className={styles.phoneWrap}>
            <div className={styles.phone}>
              <p className={styles.phoneTitle}>
                {h} <span>{a}</span>
              </p>
              <p className={styles.phoneIntro}>{i}</p>
            </div>
          </div>
        </figure>
        <figure>
          <figcaption className="adm-small">Desktop (1440 × 900 px, verkleind)</figcaption>
          <div className={styles.deskWrap}>
            <div className={styles.deskPhoto} aria-hidden="true">
              Foto
            </div>
            <div className={styles.desk}>
              <p className={styles.deskTitle}>
                {h} <span>{a}</span>
              </p>
              <p className={styles.deskIntro}>{i}</p>
            </div>
          </div>
        </figure>
      </div>
    </div>
  )
}
