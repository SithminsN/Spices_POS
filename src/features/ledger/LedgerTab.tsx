import { useMemo, useState } from 'react'
import type { TransactionType } from '../../types'
import { useAppData } from '../../context/AppDataContext'
import { TransactionRow } from '../../components/common/TransactionRow'
import './LedgerTab.css'

type LedgerFilter = 'all' | TransactionType

const FILTERS: Array<{ id: LedgerFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sell', label: 'Sales' },
  { id: 'buy', label: 'Purchases' },
]

const EMPTY_MESSAGES: Record<LedgerFilter, string> = {
  all: 'No transactions yet',
  sell: 'No sales yet',
  buy: 'No purchases yet',
}

export default function LedgerTab() {
  const { transactions } = useAppData()
  const [filter, setFilter] = useState<LedgerFilter>('all')

  const filtered = useMemo(() => {
    const scoped = filter === 'all' ? transactions : transactions.filter((t) => t.type === filter)
    return scoped.slice().sort((a, b) => b.timestamp - a.timestamp)
  }, [transactions, filter])

  return (
    <div className="ledger-tab">
      <div className="ledger-tab__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${filter === f.id ? 'is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">{EMPTY_MESSAGES[filter]}</div>
      ) : (
        <div className="stack">
          {filtered.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  )
}
