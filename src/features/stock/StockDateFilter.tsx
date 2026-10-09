import { dateKeyOf, formatDate, shiftDateKey, startOfDateKey } from '../../lib/format'

/** yyyy-mm-dd keys from the date inputs; '' means unbounded on that side. */
export interface DateFilterValue {
  from: string
  to: string
}

interface StockDateFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
  /** from is after to -- StockTab shows no figures until it's fixed. */
  isInvalid: boolean
}

const PRESETS: Array<{ label: string; range: (today: string) => DateFilterValue }> = [
  { label: 'All time', range: () => ({ from: '', to: '' }) },
  { label: 'Today', range: (today) => ({ from: today, to: today }) },
  { label: 'Last 7 days', range: (today) => ({ from: shiftDateKey(today, -6), to: today }) },
  { label: 'This month', range: (today) => ({ from: `${today.slice(0, 8)}01`, to: today }) },
  {
    label: 'Last month',
    range: (today) => {
      const lastDayOfLastMonth = shiftDateKey(`${today.slice(0, 8)}01`, -1)
      return { from: `${lastDayOfLastMonth.slice(0, 8)}01`, to: lastDayOfLastMonth }
    },
  },
]

function describe({ from, to }: DateFilterValue): string {
  const fromText = from && formatDate(startOfDateKey(from))
  const toText = to && formatDate(startOfDateKey(to))
  if (!from && !to) return 'Showing all time. Pick a range to see each product’s stock movement for that period.'
  if (from && to && from === to) return `Showing ${fromText}. Stock and value are as at the end of that day.`
  if (from && to) return `Showing ${fromText} – ${toText}. Stock and value are as at the end of ${toText}.`
  if (from) return `Showing ${fromText} to now. Stock and value are as at now.`
  return `Showing everything up to ${toText}. Stock and value are as at the end of that day.`
}

/** Start/end date filter for the Stock tab, with quick ranges. */
export function StockDateFilter({ value, onChange, isInvalid }: StockDateFilterProps) {
  const today = dateKeyOf(Date.now())
  const isFiltered = value.from !== '' || value.to !== ''

  return (
    <section className="card stock-filter" aria-label="Date filter">
      <div className="stock-filter__controls">
        <div className="stock-filter__presets" role="group" aria-label="Quick ranges">
          {PRESETS.map((preset) => {
            const range = preset.range(today)
            const isActive = range.from === value.from && range.to === value.to
            return (
              <button
                key={preset.label}
                type="button"
                className={`chip ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => onChange(range)}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="stock-filter__dates">
          <div className="field">
            <label htmlFor="stock-filter-from">Start date</label>
            <input
              id="stock-filter-from"
              className="num"
              type="date"
              value={value.from}
              max={value.to || today}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="stock-filter-to">End date</label>
            <input
              id="stock-filter-to"
              className="num"
              type="date"
              value={value.to}
              min={value.from || undefined}
              max={today}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="stock-filter__footer">
        <p className={`stock-filter__summary ${isInvalid ? 'is-invalid' : ''}`} role={isInvalid ? 'alert' : undefined}>
          {isInvalid ? 'The start date is after the end date. Pick a start date on or before the end date.' : describe(value)}
        </p>
        {isFiltered && (
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ from: '', to: '' })}>
            Clear
          </button>
        )}
      </div>
    </section>
  )
}
