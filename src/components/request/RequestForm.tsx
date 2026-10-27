'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { submitRequest, type RequestState } from '@/app/(site)/aanvragen/actions'
import { Alert, ArrowRight, Calendar, Check, Info, WhatsApp } from '@/components/icons'
import { calculateQuote, type PricingRules, type PromotionRule, type PublicDayPrice, type PublicDeposit, type RateCard } from '@/domain/pricing'
import { validateRequest, type FieldErrors, type RequestField, type RequestInput } from '@/domain/request-validation'
import { formatDateTimeLong, formatDuration, localToUtc, toLocalInputValues } from '@/domain/time'
import { formatEuro } from '@/lib/format'
import { availabilityMessage, whatsappUrl } from '@/lib/whatsapp'
import styles from './RequestForm.module.css'

export type RequestVehicle = {
  slug: string
  name: string
  code: string
  price: PublicDayPrice
  deposit: PublicDeposit
  /** Alleen gevuld als de tariefregels door de eigenaar zijn bevestigd. */
  quote: { rate: RateCard; promotions: PromotionRule[] } | null
}

type Props = {
  vehicles: RequestVehicle[]
  defaultSlug?: string | null
  whatsapp: string
  rules: PricingRules
  privacyPublished: boolean
  headingLevel?: 'h2' | 'h3'
}

const EMPTY: RequestInput = {
  vehicle: '',
  startDate: '',
  startTime: '10:00',
  endDate: '',
  endTime: '10:00',
  name: '',
  phone: '',
  email: '',
  message: '',
}

const CONNECTION_ERROR =
  'De verbinding met de server is mislukt. Je aanvraag is niet verstuurd en er is niets opgeslagen. Probeer het opnieuw of stuur je aanvraag via WhatsApp.'

const FIELD_ORDER: RequestField[] = ['vehicle', 'startDate', 'startTime', 'endDate', 'endTime', 'name', 'phone', 'email', 'message']

const FIELD_LABELS: Record<RequestField, string> = {
  vehicle: 'Auto',
  startDate: 'Begindatum',
  startTime: 'Begintijd',
  endDate: 'Einddatum',
  endTime: 'Eindtijd',
  name: 'Naam',
  phone: 'Telefoonnummer',
  email: 'E-mailadres',
  message: 'Bericht',
}

export function RequestForm({ vehicles, defaultSlug, whatsapp, rules, privacyPublished, headingLevel = 'h2' }: Props) {
  const uid = useId()
  const id = (f: string) => `${uid}-${f}`
  const formRef = useRef<HTMLFormElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<RequestInput>(() => ({
    ...EMPTY,
    vehicle: defaultSlug && vehicles.some((v) => v.slug === defaultSlug) ? defaultSlug : (vehicles.length === 1 ? vehicles[0]!.slug : ''),
  }))
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  // Zonder JavaScript post het formulier rechtstreeks naar de Server Action (formAction).
  const [serverState, formAction, serverPending] = useActionState<RequestState, FormData>(submitRequest, { status: 'idle' })
  // Met JavaScript roepen we de actie zelf aan, zodat een verbroken verbinding
  // een nette melding geeft en de ingevulde gegevens blijven staan.
  const [clientState, setClientState] = useState<RequestState | null>(null)
  const [clientPending, startSubmit] = useTransition()
  const state = clientState ?? serverState
  const pending = serverPending || clientPending
  const [dismissed, setDismissed] = useState(false)
  const [today, setToday] = useState('')

  useEffect(() => {
    setToday(toLocalInputValues(new Date()).date)
  }, [])

  const Heading = headingLevel
  const selected = vehicles.find((v) => v.slug === values.vehicle) ?? null
  const serverErrors = state.status === 'invalid' ? state.errors : {}
  const errors: FieldErrors = clientErrors ?? serverErrors
  const errorList = FIELD_ORDER.filter((f) => errors[f])

  const period = useMemo(() => {
    const s = values.startDate && values.startTime ? localToUtc(values.startDate, values.startTime) : null
    const e = values.endDate && values.endTime ? localToUtc(values.endDate, values.endTime) : null
    if (s?.ok && e?.ok && e.instant.getTime() > s.instant.getTime()) return { start: s.instant, end: e.instant }
    return null
  }, [values.startDate, values.startTime, values.endDate, values.endTime])

  const quote = useMemo(() => {
    if (!selected?.quote || !period) return null
    const q = calculateQuote({ start: period.start, end: period.end, rate: selected.quote.rate, rules, promotions: selected.quote.promotions })
    return q.kind === 'berekend' ? q : null
  }, [selected, period, rules])

  const waText = availabilityMessage({
    vehicleName: selected?.name,
    start: period?.start ?? null,
    end: period?.end ?? null,
    name: values.name.trim() || null,
    message: values.message.trim() || null,
  })

  const update = (field: RequestField, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      // Einddatum meeschuiven als die vóór de nieuwe begindatum ligt.
      if (field === 'startDate' && value && (!prev.endDate || prev.endDate < value)) next.endDate = value
      if (attempted) {
        const check = validateRequest(next, new Date())
        setClientErrors(check.ok ? {} : check.errors)
      }
      return next
    })
    if (!startedAt) setStartedAt(Date.now())
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAttempted(true)
    setDismissed(false)
    const check = validateRequest(values, new Date())
    if (!check.ok) {
      setClientErrors(check.errors)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setClientErrors(null)
    const fd = new FormData(e.currentTarget)
    if (startedAt) fd.set('startedAt', String(startedAt))
    startSubmit(async () => {
      try {
        const result = await submitRequest(state, fd)
        setClientState(result)
      } catch {
        setClientState({ status: 'error', message: CONNECTION_ERROR })
      }
    })
  }

  // Na een serverantwoord de focus verplaatsen naar het resultaat.
  useEffect(() => {
    if (state.status === 'success' || state.status === 'error' || state.status === 'limited') {
      resultRef.current?.focus()
    } else if (state.status === 'invalid') {
      setClientErrors(null)
      summaryRef.current?.focus()
    }
  }, [state])

  const reset = () => {
    setValues((prev) => ({ ...EMPTY, vehicle: prev.vehicle }))
    setAttempted(false)
    setClientErrors(null)
    setDismissed(true)
    setClientState(null)
    setStartedAt(null)
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input, select')?.focus())
  }

  if (state.status === 'success' && !dismissed) {
    const start = new Date(state.start)
    const end = new Date(state.end)
    return (
      <div ref={resultRef} tabIndex={-1} className={styles.success} role="status">
        <span className={styles.successIcon} aria-hidden="true">
          <Check size={26} />
        </span>
        <Heading className="t-h3">{state.duplicate ? 'Deze aanvraag hadden we al ontvangen' : 'Aanvraag ontvangen'}</Heading>
        <p className={styles.reference}>
          Aanvraagnummer <strong className="t-mono">{state.reference}</strong>
        </p>
        <dl className={styles.recap}>
          <div>
            <dt>Auto</dt>
            <dd>{state.vehicleName}</dd>
          </div>
          <div>
            <dt>Van</dt>
            <dd>{formatDateTimeLong(start)}</dd>
          </div>
          <div>
            <dt>Tot</dt>
            <dd>{formatDateTimeLong(end)}</dd>
          </div>
        </dl>
        <p className={styles.successText}>
          Dit is nog geen reservering. Je hoort persoonlijk of de auto beschikbaar is en ontvangt dan de huurvoorwaarden. Pas na
          die bevestiging is de auto voor je gereserveerd.
        </p>
        <div className={styles.successActions}>
          <a
            className="btn btn--secondary"
            href={whatsappUrl(
              whatsapp,
              availabilityMessage({ vehicleName: state.vehicleName, start, end, reference: state.reference }),
            )}
            rel="noopener"
            target="_blank"
          >
            <WhatsApp size={18} />
            Stuur je aanvraagnummer via WhatsApp
          </a>
          <button type="button" className="btn btn--ghost" onClick={reset}>
            Nog een aanvraag doen
          </button>
        </div>
      </div>
    )
  }

  const describedBy = (f: RequestField, hint?: boolean) =>
    [hint ? id(`${f}-hint`) : null, errors[f] ? id(`${f}-error`) : null].filter(Boolean).join(' ') || undefined

  const fieldError = (f: RequestField) =>
    errors[f] ? (
      <p className="field__error" id={id(`${f}-error`)}>
        <Alert size={16} />
        <span>{errors[f]}</span>
      </p>
    ) : null

  return (
    <form ref={formRef} className={styles.form} action={formAction} onSubmit={onSubmit} noValidate aria-describedby={id('intro')}>
      <p id={id('intro')} className="visually-hidden">
        Beschikbaarheidsaanvraag. Velden met een sterretje zijn verplicht.
      </p>

      <div
        ref={summaryRef}
        tabIndex={-1}
        className={styles.errorSummary}
        role="alert"
        hidden={errorList.length === 0}
      >
        {errorList.length ? (
          <>
            <p className={styles.errorTitle}>
              <Alert size={18} />
              {errorList.length === 1 ? 'Eén veld heeft aandacht nodig' : `${errorList.length} velden hebben aandacht nodig`}
            </p>
            <ul>
              {errorList.map((f) => (
                <li key={f}>
                  <a href={`#${id(f === 'vehicle' ? `vehicle-${values.vehicle || vehicles[0]?.slug}` : f)}`}>
                    {FIELD_LABELS[f]}: {errors[f]}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {/* Auto */}
      <fieldset className={styles.fieldset} aria-describedby={errors.vehicle ? id('vehicle-error') : undefined}>
        <legend className={styles.legend}>
          <span className={styles.step}>01</span> Auto <span aria-hidden="true">*</span>
        </legend>
        <div className={styles.vehicles}>
          {vehicles.map((v) => (
            <label key={v.slug} className={styles.vehicleOption} htmlFor={id(`vehicle-${v.slug}`)}>
              <input
                type="radio"
                id={id(`vehicle-${v.slug}`)}
                name="vehicle"
                value={v.slug}
                checked={values.vehicle === v.slug}
                onChange={() => update('vehicle', v.slug)}
                required
              />
              <span className={styles.vehicleCode}>{v.code}</span>
              <span className={styles.vehicleName}>{v.name}</span>
            </label>
          ))}
        </div>
        {fieldError('vehicle')}
      </fieldset>

      {/* Periode */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          <span className={styles.step}>02</span> Gewenste periode <span aria-hidden="true">*</span>
        </legend>
        <p className={styles.legendHint} id={id('period-hint')}>
          <Calendar size={16} /> Tijden in Nederlandse tijd. Je vraagt beschikbaarheid aan; dit is nog geen reservering.
        </p>
        <div className={styles.periodGrid}>
          <div className={styles.pair}>
            <div className="field">
              <label className="field__label" htmlFor={id('startDate')}>
                Begindatum <span aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                type="date"
                id={id('startDate')}
                name="startDate"
                value={values.startDate}
                min={today || undefined}
                onChange={(e) => update('startDate', e.target.value)}
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={describedBy('startDate')}
                required
              />
              {fieldError('startDate')}
            </div>
            <div className="field">
              <label className="field__label" htmlFor={id('startTime')}>
                Begintijd <span aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                type="time"
                id={id('startTime')}
                name="startTime"
                step={900}
                value={values.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                aria-invalid={errors.startTime ? true : undefined}
                aria-describedby={describedBy('startTime')}
                required
              />
              {fieldError('startTime')}
            </div>
          </div>
          <div className={styles.pair}>
            <div className="field">
              <label className="field__label" htmlFor={id('endDate')}>
                Einddatum <span aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                type="date"
                id={id('endDate')}
                name="endDate"
                value={values.endDate}
                min={values.startDate || today || undefined}
                onChange={(e) => update('endDate', e.target.value)}
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={describedBy('endDate')}
                required
              />
              {fieldError('endDate')}
            </div>
            <div className="field">
              <label className="field__label" htmlFor={id('endTime')}>
                Eindtijd <span aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                type="time"
                id={id('endTime')}
                name="endTime"
                step={900}
                value={values.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                aria-invalid={errors.endTime ? true : undefined}
                aria-describedby={describedBy('endTime')}
                required
              />
              {fieldError('endTime')}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Gegevens */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          <span className={styles.step}>03</span> Je gegevens
        </legend>
        <div className={styles.detailsGrid}>
          <div className="field">
            <label className="field__label" htmlFor={id('name')}>
              Naam <span aria-hidden="true">*</span>
            </label>
            <input
              className="input"
              type="text"
              id={id('name')}
              name="name"
              autoComplete="name"
              maxLength={80}
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy('name')}
              required
            />
            {fieldError('name')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('phone')}>
              Telefoonnummer <span aria-hidden="true">*</span>
            </label>
            <input
              className="input"
              type="tel"
              id={id('phone')}
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              maxLength={24}
              value={values.phone}
              onChange={(e) => update('phone', e.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy('phone', true)}
              required
            />
            <p className="field__hint" id={id('phone-hint')}>
              We nemen meestal contact op via WhatsApp of telefoon.
            </p>
            {fieldError('phone')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('email')}>
              E-mailadres <span className="field__optional">(optioneel)</span>
            </label>
            <input
              className="input"
              type="email"
              id={id('email')}
              name="email"
              autoComplete="email"
              inputMode="email"
              maxLength={120}
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy('email')}
            />
            {fieldError('email')}
          </div>
          <div className={`field ${styles.full}`}>
            <label className="field__label" htmlFor={id('message')}>
              Bericht <span className="field__optional">(optioneel)</span>
            </label>
            <textarea
              className="textarea"
              id={id('message')}
              name="message"
              rows={4}
              maxLength={1000}
              value={values.message}
              onChange={(e) => update('message', e.target.value)}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy('message', true)}
            />
            <p className="field__hint" id={id('message-hint')}>
              Bijvoorbeeld een voorkeur voor ophaaltijden. Stuur geen kopie van je rijbewijs of andere documenten.
            </p>
            {fieldError('message')}
          </div>
        </div>
      </fieldset>

      {/* Verborgen voor mensen; bots vullen dit veld wel in. */}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor={id('website')}>Laat dit veld leeg</label>
        <input type="text" id={id('website')} name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* Samenvatting en prijsindicatie */}
      <div className={styles.summary} aria-live="polite">
        <p className="t-label">Je vraagt aan</p>
        <p className={styles.summaryMain}>
          {selected ? selected.name : 'Nog geen auto gekozen'}
          {period ? (
            <span className={styles.summaryPeriod}>
              {formatDateTimeLong(period.start)} tot {formatDateTimeLong(period.end)} · {formatDuration(period.start, period.end)}
            </span>
          ) : null}
        </p>
        {selected ? (
          <div className={styles.summaryPrice}>
            {quote ? (
              <p>
                Indicatie voor deze periode: <strong className="nums">{formatEuro(quote.totalCents)}</strong>
                {quote.vatNote ? ` ${quote.vatNote}` : ''} · {quote.days} {quote.days === 1 ? 'huurdag' : 'huurdagen'}
              </p>
            ) : selected.price.kind === 'dagprijs' ? (
              <p>
                {selected.price.confirmed ? 'Vanaf' : 'Richtprijs'}{' '}
                <strong className="nums">
                  {formatEuro(selected.price.promotion?.dayRateCents ?? selected.price.dayRateCents)}
                </strong>{' '}
                per dag · definitieve prijs op aanvraag
              </p>
            ) : (
              <p>Prijs op aanvraag</p>
            )}
            {selected.deposit.kind === 'borg' ? (
              <p className={styles.summaryDeposit}>
                Borg <span className="nums">{formatEuro(selected.deposit.cents)}</span> (los van de huurprijs)
                {!selected.deposit.confirmed ? ', indicatie' : ''}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {state.status === 'error' || state.status === 'limited' ? (
        <div ref={resultRef} tabIndex={-1} className={styles.failure} role="alert">
          <p className={styles.failureTitle}>
            <Alert size={18} />
            {state.status === 'limited' ? 'Even geduld' : 'Niet verstuurd'}
          </p>
          <p>{state.message}</p>
          <a className="btn btn--secondary btn--sm" href={whatsappUrl(whatsapp, waText)} rel="noopener" target="_blank">
            <WhatsApp size={18} />
            Stuur je aanvraag via WhatsApp
          </a>
        </div>
      ) : null}

      <div className={styles.submitRow}>
        <button type="submit" className="btn btn--primary" disabled={pending} aria-disabled={pending}>
          {pending ? 'Bezig met versturen…' : 'Verstuur aanvraag'}
          {!pending ? <ArrowRight className="btn__icon btn__icon--move" /> : null}
        </button>
        <a className={`link-arrow ${styles.waLink}`} href={whatsappUrl(whatsapp, waText)} rel="noopener" target="_blank">
          <WhatsApp size={18} />
          <span>Liever via WhatsApp</span>
        </a>
      </div>

      <p className={styles.privacy}>
        <Info size={16} />
        <span>
          We gebruiken je gegevens alleen om je aanvraag te beantwoorden.
          {privacyPublished ? (
            <>
              {' '}
              Lees de <Link href="/privacy">privacyverklaring</Link>.
            </>
          ) : null}
        </span>
      </p>
    </form>
  )
}
