import { useState } from 'react'
import type { CashEntryType } from '../../types'
import { CASH_ENTRY_TYPE_LABELS } from '../../lib/constants'
import { formatCurrency } from '../../lib/format'
import { computeCashSummary } from '../../lib/calculations'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { StatCard } from '../../components/common/StatCard'
import { CashEntryRow } from '../../components/common/CashEntryRow'
import './CashTab.css'

const CASH_ENTRY_TYPES = Object.keys(CASH_ENTRY_TYPE_LABELS) as CashEntryType[]

export default function CashTab() {
  const { cashEntries, transactions, addCashEntry } = useAppData()
  const { showToast } = useToast()

  const [type, setType] = useState<CashEntryType>(CASH_ENTRY_TYPES[0])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const summary = computeCashSummary(cashEntries, transactions)
  const sortedEntries = cashEntries.slice().sort((a, b) => b.timestamp - a.timestamp)

  function handleSave() {
    const parsedAmount = Number(amount)
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Enter a valid amount', 'error')
      return
    }
    addCashEntry({ type, amount: parsedAmount, note: note.trim() })
    showToast('Entry added')
    setType(CASH_ENTRY_TYPES[0])
    setAmount('')
    setNote('')
  }

  return (
    <div className="stack cash-tab">
      <div className="cash-tab__stats">
        <StatCard
          label="Cash Drawer"
          value={formatCurrency(summary.cashDrawer)}
          tone={summary.cashDrawer >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="You Owe"
          value={formatCurrency(summary.youOwe)}
          tone={summary.youOwe > 0 ? 'negative' : 'default'}
        />
        <StatCard
          label="Owed to You"
          value={formatCurrency(summary.owedToYou)}
          tone={summary.owedToYou > 0 ? 'positive' : 'default'}
        />
      </div>

      <div className="card cash-tab__form">
        <div className="section-title">Add Entry</div>
        <div className="cash-tab__form-fields">
          <div className="field">
            <label htmlFor="cash-tab-type">Type</label>
            <select
              id="cash-tab-type"
              value={type}
              onChange={(e) => setType(e.target.value as CashEntryType)}
            >
              {CASH_ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CASH_ENTRY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cash-tab-amount">Amount</label>
            <input
              id="cash-tab-amount"
              className="num"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cash-tab-note">Note</label>
            <input
              id="cash-tab-note"
              type="text"
              placeholder="Optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
          Save Entry
        </button>
      </div>

      <div className="cash-tab__list">
        <div className="section-title">All Entries</div>
        {sortedEntries.length === 0 ? (
          <div className="empty-state">No cash entries yet.</div>
        ) : (
          <div className="stack">
            {sortedEntries.map((entry) => (
              <CashEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
