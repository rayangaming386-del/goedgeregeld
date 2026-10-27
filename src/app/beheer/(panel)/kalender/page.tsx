import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { PLANNING_LABELS, PlanningIcon } from '@/components/admin/Badges'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, ChevronLeft, ChevronRight } from '@/components/icons'
import { blockingItems, findConflicts } from '@/domain/availability'
import { can } from '@/domain/permissions'
import { planningKind } from '@/domain/reservation-status'
import {
  addDaysToDateKey,
  formatDate,
  formatPeriod,
  formatTime,
  isValidDateString,
  localDateKey,
  startOfLocalDay,
  toLocalInputValues,
  weekdayOfDateKey,
} from '@/domain/time'
import { planningInRange, vehicleOptions } from '@/server/admin/queries'
import { modelCode } from '@/server/public/queries'
import { requireUser } from '@/server/auth/session'
import { createBlockAction, deleteBlockAction } from './actions'
import styles from './kalender.module.css'

export const metadata: Metadata = { title: 'Kalender' }

type Kind = 'aanvraag' | 'optie' | 'bevestigd' | 'afgerond' | 'onderhoud' | 'blokkade'

type Item = {
  id: string
  kind: Kind
  vehicleId: string
  start: Date
  end: Date
  title: string
  href: string | null
  conflict: boolean
  isBlock: boolean
}

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function mondayOf(key: string): string {
  return addDaysToDateKey(key, -((weekdayOfDateKey(key) + 6) % 7))
}

function lanes(items: Item[]): Map<string, number> {
  const ends: number[] = []
  const result = new Map<string, number>()
  for (const it of [...items].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    let lane = ends.findIndex((end) => end <= it.start.getTime())
    if (lane === -1) {
      lane = ends.length
      ends.push(0)
    }
    ends[lane] = it.end.getTime()
    result.set(it.id, lane)
  }
  return result
}

export default async function CalendarPage({ searchParams }: PageProps<'/beheer/kalender'>) {
  const user = await requireUser()
  if (!can(user.role, 'aanvragen:bekijken')) return <NoAccess />
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const view: 'week' | 'maand' = get('weergave') === 'week' ? 'week' : 'maand'
  const now = new Date()
  const today = localDateKey(now)
  const anchor = isValidDateString(get('datum')) ? get('datum') : today
  const vehicleFilter = get('auto')

  let firstDay: string
  let dayCount: number
  let monthLabel = ''
  if (view === 'week') {
    firstDay = mondayOf(anchor)
    dayCount = 7
  } else {
    const [y, m] = anchor.split('-').map(Number) as [number, number]
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDate = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`
    firstDay = mondayOf(first)
    const lastMonday = mondayOf(last)
    const weeks = Math.round((Date.parse(lastMonday) - Date.parse(firstDay)) / (7 * 86_400_000)) + 1
    dayCount = weeks * 7
    monthLabel = `${MONTHS[m - 1]} ${y}`
  }
  const days = Array.from({ length: dayCount }, (_, i) => addDaysToDateKey(firstDay, i))
  const rangeStart = startOfLocalDay(days[0]!)
  const rangeEnd = startOfLocalDay(addDaysToDateKey(days.at(-1)!, 1))

  const [vehicles, planning] = await Promise.all([vehicleOptions(), planningInRange(rangeStart, rangeEnd, vehicleFilter || undefined)])
  const activeVehicles = vehicles.filter((v) => (vehicleFilter ? v.id === vehicleFilter : v.status !== 'gearchiveerd'))
  const nameOf = new Map(vehicles.map((v) => [v.id, modelCode(v.model)]))

  const items: Item[] = []
  for (const v of activeVehicles) {
    const res = planning.reservations.filter((r) => r.vehicleId === v.id)
    const blocks = planning.blocks.filter((b) => b.vehicleId === v.id)
    const blocking = blockingItems(res, blocks, now)
    for (const r of res) {
      const kind = planningKind(r, now)
      if (kind === 'gesloten') continue
      const conflict = kind !== 'afgerond' && findConflicts(r, blocking.filter((b) => b.id !== r.id)).length > 0
      items.push({
        id: r.id,
        kind,
        vehicleId: v.id,
        start: r.start,
        end: r.end,
        title: `${r.reference} · ${r.customerName}`,
        href: `/beheer/aanvragen/${r.id}`,
        conflict,
        isBlock: false,
      })
    }
    for (const b of blocks) {
      const conflict = findConflicts(b, blocking.filter((x) => x.id !== b.id && (x.kind === 'bevestigd' || x.kind === 'optie'))).length > 0
      items.push({ id: b.id, kind: b.kind, vehicleId: v.id, start: b.start, end: b.end, title: b.reason || PLANNING_LABELS[b.kind], href: null, conflict, isBlock: true })
    }
  }

  const qs = (params: Record<string, string>) => {
    const p = new URLSearchParams({ weergave: view, datum: anchor, ...(vehicleFilter ? { auto: vehicleFilter } : {}), ...params })
    return `/beheer/kalender?${p.toString()}`
  }
  const step = view === 'week' ? 7 : 0
  const prevAnchor = view === 'week' ? addDaysToDateKey(anchor, -step) : (() => {
    const [y, m] = anchor.split('-').map(Number) as [number, number]
    const d = new Date(Date.UTC(y, m - 2, 1))
    return d.toISOString().slice(0, 10)
  })()
  const nextAnchor = view === 'week' ? addDaysToDateKey(anchor, step) : (() => {
    const [y, m] = anchor.split('-').map(Number) as [number, number]
    const d = new Date(Date.UTC(y, m, 1))
    return d.toISOString().slice(0, 10)
  })()
  const canPlan = can(user.role, 'planning:beheren')
  const total = rangeEnd.getTime() - rangeStart.getTime()
  const pct = (t: number) => ((t - rangeStart.getTime()) / total) * 100
  const anchorMonth = anchor.slice(0, 7)
  const blockItems = items.filter((i) => i.isBlock).sort((a, b) => a.start.getTime() - b.start.getTime())
  const defaultStart = toLocalInputValues(now)

  const itemLabel = (it: Item) => (
    <>
      <PlanningIcon kind={it.kind} />
      <span className={styles.itemKind}>{PLANNING_LABELS[it.kind]}</span>
      <span className={styles.itemTitle}>{it.title}</span>
      {it.conflict ? (
        <span className={styles.conflict}>
          <Alert size={12} />
          Overlap
        </span>
      ) : null}
    </>
  )

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Aanvragen, tijdelijke opties, bevestigde reserveringen en blokkades. Een aanvraag zonder optie blokkeert de auto niet."
      />

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Link className="btn btn--secondary btn--sm" href={qs({ datum: prevAnchor })} aria-label={view === 'week' ? 'Vorige week' : 'Vorige maand'}>
            <ChevronLeft size={16} />
          </Link>
          <Link className="btn btn--ghost btn--sm" href={qs({ datum: today })}>
            Vandaag
          </Link>
          <Link className="btn btn--secondary btn--sm" href={qs({ datum: nextAnchor })} aria-label={view === 'week' ? 'Volgende week' : 'Volgende maand'}>
            <ChevronRight size={16} />
          </Link>
          <h2 className={styles.rangeTitle} aria-live="polite">
            {view === 'week' ? `Week van ${formatDate(rangeStart)}` : monthLabel}
          </h2>
        </div>
        <div className={styles.nav}>
          <nav className="adm-tabs" aria-label="Weergave" style={{ margin: 0, border: 0 }}>
            <Link href={qs({ weergave: 'maand' })} aria-current={view === 'maand' ? 'page' : undefined}>
              Maand
            </Link>
            <Link href={qs({ weergave: 'week' })} aria-current={view === 'week' ? 'page' : undefined}>
              Week
            </Link>
          </nav>
          <form method="get" className={styles.filter}>
            <input type="hidden" name="weergave" value={view} />
            <input type="hidden" name="datum" value={anchor} />
            <label className="visually-hidden" htmlFor="kal-auto">
              Filter op auto
            </label>
            <select className="select" id="kal-auto" name="auto" defaultValue={vehicleFilter}>
              <option value="">Alle auto’s</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--secondary btn--sm">
              Toon
            </button>
          </form>
        </div>
      </div>

      <ul className={styles.legend} aria-label="Legenda">
        {(['aanvraag', 'optie', 'bevestigd', 'afgerond', 'onderhoud', 'blokkade'] as const).map((k) => (
          <li key={k} className={`${styles.item} ${styles[`k_${k}`]}`}>
            <PlanningIcon kind={k} />
            {PLANNING_LABELS[k]}
          </li>
        ))}
      </ul>

      {/* Desktop: maandraster of weektijdlijn */}
      <div className={styles.desktop}>
        {view === 'maand' ? (
          <div className={styles.month} role="table" aria-label={`Planning ${monthLabel}`}>
            <div role="row" className={styles.monthHead}>
              {WEEKDAYS.map((d) => (
                <div role="columnheader" key={d}>
                  {d}
                </div>
              ))}
            </div>
            {Array.from({ length: dayCount / 7 }, (_, w) => (
              <div role="row" className={styles.monthRow} key={w}>
                {days.slice(w * 7, w * 7 + 7).map((day) => {
                  const ds = startOfLocalDay(day).getTime()
                  const de = startOfLocalDay(addDaysToDateKey(day, 1)).getTime()
                  const dayItems = items.filter((i) => i.start.getTime() < de && i.end.getTime() > ds)
                  return (
                    <div
                      role="cell"
                      key={day}
                      className={`${styles.day} ${day.slice(0, 7) !== anchorMonth ? styles.outside : ''} ${day === today ? styles.today : ''}`}
                    >
                      <Link href={qs({ weergave: 'week', datum: day })} className={styles.dayNum} aria-label={`Week van ${formatDate(new Date(ds))}`}>
                        {Number(day.slice(8))}
                      </Link>
                      <ul className={styles.dayItems}>
                        {dayItems.slice(0, 3).map((it) => (
                          <li key={it.id} className={`${styles.item} ${styles[`k_${it.kind}`]} ${it.conflict ? styles.hasConflict : ''}`}>
                            {it.href ? (
                              <Link href={it.href}>
                                <span className={styles.itemCar}>{nameOf.get(it.vehicleId)}</span>
                                {itemLabel(it)}
                              </Link>
                            ) : (
                              <span>
                                <span className={styles.itemCar}>{nameOf.get(it.vehicleId)}</span>
                                {itemLabel(it)}
                              </span>
                            )}
                          </li>
                        ))}
                        {dayItems.length > 3 ? (
                          <li>
                            <Link href={qs({ weergave: 'week', datum: day })} className="adm-small">
                              +{dayItems.length - 3} meer
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.week}>
            <div className={styles.weekHead}>
              <div />
              <div className={styles.weekDays}>
                {days.map((day, i) => (
                  <div key={day} className={day === today ? styles.today : ''}>
                    {WEEKDAYS[i]} {Number(day.slice(8))}
                  </div>
                ))}
              </div>
            </div>
            {activeVehicles.map((v) => {
              const rowItems = items.filter((i) => i.vehicleId === v.id)
              const laneOf = lanes(rowItems)
              const laneCount = Math.max(1, ...[...laneOf.values()].map((l) => l + 1))
              return (
                <div className={styles.weekRow} key={v.id}>
                  <div className={styles.weekCar}>{v.name}</div>
                  <div className={styles.weekTrack} style={{ height: `${laneCount * 2.75 + 0.75}rem` }}>
                    {days.map((day) => (
                      <span key={day} className={styles.gridLine} style={{ left: `${pct(startOfLocalDay(day).getTime())}%` }} aria-hidden="true" />
                    ))}
                    {rowItems.map((it) => {
                      const left = Math.max(0, pct(it.start.getTime()))
                      const right = Math.min(100, pct(it.end.getTime()))
                      const style = {
                        left: `${left}%`,
                        width: `${Math.max(2.5, right - left)}%`,
                        top: `${(laneOf.get(it.id) ?? 0) * 2.75 + 0.4}rem`,
                      }
                      const label = `${PLANNING_LABELS[it.kind]}: ${it.title}, ${formatPeriod(it.start, it.end)}${it.conflict ? ', overlap' : ''}`
                      return it.href ? (
                        <Link key={it.id} href={it.href} className={`${styles.bar} ${styles.item} ${styles[`k_${it.kind}`]} ${it.conflict ? styles.hasConflict : ''}`} style={style} title={label} aria-label={label}>
                          {itemLabel(it)}
                        </Link>
                      ) : (
                        <span key={it.id} className={`${styles.bar} ${styles.item} ${styles[`k_${it.kind}`]} ${it.conflict ? styles.hasConflict : ''}`} style={style} title={label}>
                          {itemLabel(it)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mobiel: agendalijst */}
      <div className={styles.agenda}>
        {days
          .filter((d) => view === 'week' || d.slice(0, 7) === anchorMonth)
          .map((day) => {
            const ds = startOfLocalDay(day).getTime()
            const de = startOfLocalDay(addDaysToDateKey(day, 1)).getTime()
            const dayItems = items.filter((i) => i.start.getTime() < de && i.end.getTime() > ds)
            if (!dayItems.length) return null
            return (
              <section key={day} className={styles.agendaDay} aria-label={formatDate(new Date(ds))}>
                <h3 className={day === today ? styles.today : ''}>
                  {WEEKDAYS[(weekdayOfDateKey(day) + 6) % 7]} {formatDate(new Date(ds))}
                </h3>
                <ul>
                  {dayItems.map((it) => (
                    <li key={it.id} className={`${styles.item} ${styles[`k_${it.kind}`]} ${it.conflict ? styles.hasConflict : ''}`}>
                      {it.href ? (
                        <Link href={it.href}>
                          <span className={styles.itemCar}>{nameOf.get(it.vehicleId)}</span>
                          {itemLabel(it)}
                          <span className={styles.itemTime}>
                            {formatTime(it.start)}–{formatTime(it.end)}
                          </span>
                        </Link>
                      ) : (
                        <span>
                          <span className={styles.itemCar}>{nameOf.get(it.vehicleId)}</span>
                          {itemLabel(it)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        {!items.length ? <p className="adm-small">Niets gepland in deze periode.</p> : null}
      </div>

      <div className="adm-grid adm-grid--2" style={{ marginTop: '2rem' }}>
        {canPlan ? (
          <section className="adm-panel" aria-labelledby="blok-nieuw">
            <h2 id="blok-nieuw" className="adm-section-title">
              Blokkade toevoegen
            </h2>
            <p className="adm-small">Voor onderhoud of een handmatige blokkade. Overlap met bevestigde reserveringen en actieve opties wordt geweigerd.</p>
            <ActionForm action={createBlockAction} className="adm-form" resetOnSuccess aria-label="Blokkade toevoegen">
              <div className="adm-form-grid">
                <div className="field is-wide">
                  <label className="field__label" htmlFor="b-auto">
                    Auto
                  </label>
                  <select className="select" id="b-auto" name="vehicleId" defaultValue={vehicleFilter}>
                    <option value="">Kies een auto</option>
                    {vehicles
                      .filter((v) => v.status !== 'gearchiveerd')
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                  <FieldError name="vehicleId" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-kind">
                    Soort
                  </label>
                  <select className="select" id="b-kind" name="kind" defaultValue="onderhoud">
                    <option value="onderhoud">Onderhoud</option>
                    <option value="blokkade">Handmatige blokkade</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-reason">
                    Reden
                  </label>
                  <input className="input" id="b-reason" name="reason" maxLength={200} placeholder="Bijv. APK of eigen gebruik" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-sd">
                    Begindatum
                  </label>
                  <input className="input" type="date" id="b-sd" name="startDate" defaultValue={defaultStart.date} />
                  <FieldError name="startDate" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-st">
                    Begintijd
                  </label>
                  <input className="input" type="time" id="b-st" name="startTime" step={900} defaultValue="08:00" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-ed">
                    Einddatum
                  </label>
                  <input className="input" type="date" id="b-ed" name="endDate" defaultValue={defaultStart.date} />
                  <FieldError name="endDate" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="b-et">
                    Eindtijd
                  </label>
                  <input className="input" type="time" id="b-et" name="endTime" step={900} defaultValue="18:00" />
                </div>
              </div>
              <FormMessage />
              <div className="adm-form-actions">
                <SubmitButton>Blokkade opslaan</SubmitButton>
              </div>
            </ActionForm>
          </section>
        ) : null}

        <section className="adm-panel" aria-labelledby="blok-lijst">
          <h2 id="blok-lijst" className="adm-section-title">
            Blokkades in deze periode
          </h2>
          {blockItems.length ? (
            <ul className="adm-list">
              {blockItems.map((b) => (
                <li key={b.id}>
                  <div>
                    <strong>{nameOf.get(b.vehicleId)}</strong> · {PLANNING_LABELS[b.kind]}
                    <p className="adm-small">
                      {formatPeriod(b.start, b.end)} · {b.title}
                    </p>
                  </div>
                  {canPlan ? (
                    <ActionForm action={deleteBlockAction} aria-label="Blokkade verwijderen">
                      <input type="hidden" name="blockId" value={b.id} />
                      <ConfirmSubmit
                        label="Verwijderen"
                        title="Blokkade verwijderen?"
                        description="De auto komt in deze periode weer vrij in de planning."
                        confirmLabel="Verwijderen"
                        name="bevestig"
                        value={b.id}
                      />
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-small">Geen blokkades in deze periode.</p>
          )}
        </section>
      </div>
    </>
  )
}
