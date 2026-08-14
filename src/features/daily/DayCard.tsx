import type { CashEntry, DayGroup, Transaction } from '../../types'
import { formatCurrency, formatDayLabel, formatQty } from '../../lib/format'
import { StatCard } from '../../components/common/StatCard'
import { TransactionRow } from '../../components/common/TransactionRow'
import { CashEntryRow } from '../../components/common/CashEntryRow'

interface DayCardProps {
  group: DayGroup
  expanded: boolean
  onToggle: () => void
}

type DailyEntry = { kind: 'transaction'; item: Transaction } | { kind: 'cash'; item: CashEntry }

/** Merges two already-ascending-sorted lists into one chronological list. */
function mergeChronological(transactions: Transaction[], cashEntries: CashEntry[]): DailyEntry[] {
  const merged: DailyEntry[] = []
  let i = 0
  let j = 0
  while (i < transactions.length && j < cashEntries.length) {
    if (transactions[i].timestamp <= cashEntries[j].timestamp) {
      merged.push({ kind: 'transaction', item: transactions[i] })
      i += 1
    } else {
      merged.push({ kind: 'cash', item: cashEntries[j] })
      j += 1
    }
  }
  while (i < transactions.length) {
    merged.push({ kind: 'transaction', item: transactions[i] })
    i += 1
  }
  while (j < cashEntries.length) {
    merged.push({ kind: 'cash', item: cashEntries[j] })
    j += 1
  }
  return merged
}

/** One calendar day's collapsible cashbook card: header summary, plus a combined chronological list when expanded. */
export function DayCard({ group, expanded, onToggle }: DayCardProps) {
  const dayLabel = formatDayLabel(group.timestamp, Date.now())
  const entries = mergeChronological(group.transactions, group.cashEntries)

  return (
    <div className="card day-card">
      <button type="button" className="day-card__header" onClick={onToggle} aria-expanded={expanded}>
        <div className="day-card__heading">
          <span className="day-card__date">{dayLabel}</span>
          <span className="day-card__meta">
            {group.entryCount} {group.entryCount === 1 ? 'entry' : 'entries'}
            {group.totalWeightDeducted > 0 && (
              <span className="num"> · Deducted: {formatQty(group.totalWeightDeducted)}</span>
            )}
          </span>
        </div>
        <div className="day-card__summary">
          <span className={`num day-card__net ${group.netCashFlow >= 0 ? 'amount-credit' : 'amount-debit'}`}>
            {formatCurrency(group.netCashFlow)}
          </span>
          <span className={`day-card__chevron ${expanded ? 'day-card__chevron--open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="day-card__body">
          <div className="day-card__stats">
            <StatCard label="Sales" value={formatCurrency(group.totalSales)} />
            <StatCard label="Purchases" value={formatCurrency(group.totalPurchases)} />
            <StatCard
              label="Profit"
              value={formatCurrency(group.totalProfit)}
              tone={group.totalProfit >= 0 ? 'positive' : 'negative'}
            />
            <StatCard
              label="Cash In/Out"
              value={`+${formatCurrency(group.cashIn)} / -${formatCurrency(group.cashOut)}`}
            />
          </div>
          <div className="day-card__list stack">
            {entries.map((entry) =>
              entry.kind === 'transaction' ? (
                <TransactionRow key={`t-${entry.item.id}`} transaction={entry.item} />
              ) : (
                <CashEntryRow key={`c-${entry.item.id}`} entry={entry.item} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
