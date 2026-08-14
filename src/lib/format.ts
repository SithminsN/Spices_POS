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

const fullDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

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
