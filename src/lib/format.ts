const euroWhole = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const euroCents = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 })

/** “€ 400” of “€ 399,50” */
export function formatEuro(cents: number): string {
  return cents % 100 === 0 ? euroWhole.format(cents / 100) : euroCents.format(cents / 100)
}

/** “2.500” */
export function formatInt(n: number): string {
  return integer.format(n)
}

/** 38 → “3,8” */
export function formatTenths(tenths: number): string {
  return (tenths / 10).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Euro-invoer (“400”, “399,50”, “€ 2.000”) naar centen, of null. */
export function parseEuroToCents(raw: string): number | null {
  const cleaned = raw.replace(/[€\s]/g, '').trim()
  if (!cleaned) return null
  // Duizendtallen met punt, decimalen met komma (nl) of punt.
  let normalized = cleaned
  if (/,\d{1,2}$/.test(normalized)) normalized = normalized.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/** Centen naar invoerwaarde (“400” of “399,50”). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
