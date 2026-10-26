/**
 * Tijd en tijdzone.
 *
 * Alle tijdstippen worden als UTC-instant opgeslagen (timestamptz). Invoer en
 * weergave gebeuren in de bedrijfstijdzone Europe/Amsterdam, inclusief de
 * overgangen naar zomer- en wintertijd:
 *  - Een lokaal tijdstip dat niet bestaat (laatste zondag van maart, 02:00–02:59)
 *    wordt geweigerd.
 *  - Een lokaal tijdstip dat twee keer voorkomt (laatste zondag van oktober,
 *    02:00–02:59) wordt geïnterpreteerd als het eerste moment (zomertijd).
 */

export const BUSINESS_TZ = 'Europe/Amsterdam'

export type LocalParts = {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  /** 0 = zondag … 6 = zaterdag */
  weekday: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    partsFormatterCache.set(tz, f)
  }
  return f
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Lokale kalender- en kloktijd van een instant in de gegeven tijdzone. */
export function toLocalParts(instant: Date, tz: string = BUSINESS_TZ): LocalParts {
  const parts = partsFormatter(tz).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  }
}

/** Verschil tussen lokale kloktijd en UTC in milliseconden op een instant. */
function offsetMs(instantMs: number, tz: string): number {
  const p = toLocalParts(new Date(instantMs), tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  const truncated = Math.floor(instantMs / 60_000) * 60_000
  return asUtc - truncated
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export type LocalToUtcResult =
  | { ok: true; instant: Date }
  | { ok: false; reason: 'ongeldige_datum' | 'ongeldige_tijd' | 'bestaat_niet' }

export function isValidDateString(date: string): boolean {
  const m = DATE_RE.exec(date)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return false
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= dim && y >= 2000 && y <= 2100
}

export function isValidTimeString(time: string): boolean {
  return TIME_RE.test(time)
}

/**
 * Zet een lokale datum ('YYYY-MM-DD') en tijd ('HH:mm') in de bedrijfstijdzone
 * om naar een UTC-instant.
 */
export function localToUtc(date: string, time: string, tz: string = BUSINESS_TZ): LocalToUtcResult {
  if (!isValidDateString(date)) return { ok: false, reason: 'ongeldige_datum' }
  if (!isValidTimeString(time)) return { ok: false, reason: 'ongeldige_tijd' }
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi] = time.split(':').map(Number) as [number, number]
  const wallMs = Date.UTC(y, mo - 1, d, h, mi)

  // Kandidaten: wandtijd minus de offsets die rond dit moment gelden.
  const candidates = new Set<number>()
  for (const probe of [wallMs - 36e5 * 3, wallMs, wallMs + 36e5 * 3]) {
    candidates.add(wallMs - offsetMs(probe, tz))
  }
  const matches = [...candidates]
    .filter((utcMs) => {
      const p = toLocalParts(new Date(utcMs), tz)
      return p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi
    })
    .sort((a, b) => a - b)

  if (matches.length === 0) return { ok: false, reason: 'bestaat_niet' }
  return { ok: true, instant: new Date(matches[0]!) }
}

/** Lokale datum en tijd als invoerwaarden ('YYYY-MM-DD', 'HH:mm'). */
export function toLocalInputValues(instant: Date, tz: string = BUSINESS_TZ): { date: string; time: string } {
  const p = toLocalParts(instant, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  }
}

/** Lokale datumsleutel ('YYYY-MM-DD') van een instant. */
export function localDateKey(instant: Date, tz: string = BUSINESS_TZ): string {
  return toLocalInputValues(instant, tz).date
}

/** Telt kalenderdagen bij een lokale datumsleutel op (DST-veilig, puur kalender). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Weekdag (0 = zondag) van een lokale datumsleutel. */
export function weekdayOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** UTC-instant van lokale middernacht op een datum. */
export function startOfLocalDay(dateKey: string, tz: string = BUSINESS_TZ): Date {
  const r = localToUtc(dateKey, '00:00', tz)
  if (r.ok) return r.instant
  // Middernacht bestaat in Europe/Amsterdam altijd; vangnet voor andere zones.
  const alt = localToUtc(dateKey, '01:00', tz)
  if (alt.ok) return alt.instant
  throw new Error(`Kan begin van de dag niet bepalen voor ${dateKey}`)
}

/* ───────────── Weergave (nl-NL) ───────────── */

const fmtCache = new Map<string, Intl.DateTimeFormat>()

function fmt(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('nl-NL', { timeZone: BUSINESS_TZ, ...options })
    fmtCache.set(key, f)
  }
  return f
}

/** “za 7 nov 2026, 10:00” */
export function formatDateTimeShort(instant: Date): string {
  const date = fmt('short-date', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(instant)
  const time = fmt('time', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  return `${date}, ${time}`
}

/** “zaterdag 7 november 2026 om 10:00” */
export function formatDateTimeLong(instant: Date): string {
  const date = fmt('long-date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(instant)
  const time = fmt('time', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  return `${date} om ${time}`
}

/** “7 nov 2026” */
export function formatDate(instant: Date): string {
  return fmt('date', { day: 'numeric', month: 'short', year: 'numeric' }).format(instant)
}

/** “10:00” */
export function formatTime(instant: Date): string {
  return fmt('time', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
}

/** Periode compact: “za 7 nov 2026, 10:00 – zo 8 nov 2026, 18:00” */
export function formatPeriod(start: Date, end: Date): string {
  return `${formatDateTimeShort(start)} – ${formatDateTimeShort(end)}`
}

/** Duur in hele uren/dagen, voor beheer (“2 dagen en 8 uur”). */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days} ${days === 1 ? 'dag' : 'dagen'}`)
  if (hours) parts.push(`${hours} uur`)
  if (mins && !days) parts.push(`${mins} min`)
  if (parts.length === 0) return '0 min'
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} en ${parts.at(-1)}` : parts[0]!
}
