// Presentation-only helpers. No business math lives here — see calculations.ts.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "Rs. 12,345.00" — LKR with a plain "Rs." prefix and thousands separators. */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}Rs. ${currencyFormatter.format(Math.abs(amount))}`
}

const qtyFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

/** Trims trailing zeros for quantities (e.g. weights entered as "2.5"). */
export function formatQty(value: number): string {
  return qtyFormatter.format(value)
}

export function formatQtyWithUnit(value: number, unit: string): string {
  return `${formatQty(value)} ${unit}`
}

function startOfLocalDay(timestamp: number): Date {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d
}

/** yyyy-mm-dd key in local time, used to group records by calendar day. */
export function dateKeyOf(timestamp: number): string {
  const d = startOfLocalDay(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Inverse of dateKeyOf(): epoch ms of local midnight at the start of a
 * yyyy-mm-dd day (e.g. an <input type="date"> value). Built from parts on
 * purpose -- `new Date('yyyy-mm-dd')` parses as UTC midnight, which is
 * 05:30 in Sri Lanka and would silently drop the first hours of the day.
 */
export function startOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** The yyyy-mm-dd key `days` calendar days after `dateKey` (before, if negative). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return dateKeyOf(new Date(y, m - 1, d + days).getTime())
}

/** "HH:MM" (24h) in local time -- the value format of <input type="time">. */
export function timeKeyOf(timestamp: number): string {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Local timestamp for a date + time picked in edit inputs, or null if either
 * is blank/incomplete. Returns `original` untouched when the inputs still
 * show its date and time; otherwise keeps `original`'s seconds/ms, so moving
 * a record to another day keeps its order among records from the same minute.
 */
export function timestampFromInputs(dateKey: string, timeKey: string, original: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}/.test(timeKey)) return null
  if (dateKey === dateKeyOf(original) && timeKey.slice(0, 5) === timeKeyOf(original)) return original
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = timeKey.split(':').map(Number)
  const o = new Date(original)
  return new Date(y, m - 1, d, hh, mm, o.getSeconds(), o.getMilliseconds()).getTime()
}

const fullDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "14 Aug 2026" */
export function formatDate(timestamp: number): string {
  return fullDateFormatter.format(new Date(timestamp))
}

/** "Today" / "Yesterday" / "14 Aug 2026", based on a given `now`. */
export function formatDayLabel(timestamp: number, now: number): string {
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((startOfLocalDay(now).getTime() - startOfLocalDay(timestamp).getTime()) / dayMs)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return fullDateFormatter.format(new Date(timestamp))
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "14 Aug 2026, 3:45 pm" — used on ledger/transaction rows. */
export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp))
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' })

export function formatTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp))
}
