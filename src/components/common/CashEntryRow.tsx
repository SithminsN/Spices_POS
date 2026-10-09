import { useState } from 'react'
import type { CashEntry, CashEntryType } from '../../types'
import { CASH_ENTRY_TYPE_LABELS, CASH_IN_TYPES } from '../../lib/constants'
import { dateKeyOf, formatCurrency, formatDate, formatDateTime, timeKeyOf, timestampFromInputs } from '../../lib/format'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmButton } from './ConfirmButton'
import { DateTimeFields } from './DateTimeFields'
import './CashEntryRow.css'

const CASH_ENTRY_TYPES = Object.keys(CASH_ENTRY_TYPE_LABELS) as CashEntryType[]

interface CashEntryRowProps {
  entry: CashEntry
}

/** Single cash-ledger row, reused unmodified by the Cash tab and the Daily tab's per-day list. */
export function CashEntryRow({ entry }: CashEntryRowProps) {
  const { updateCashEntry, deleteCashEntry } = useAppData()
  const { showToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [type, setType] = useState<CashEntryType>(entry.type)
  const [amount, setAmount] = useState(entry.amount)
  const [note, setNote] = useState(entry.note)
  const [dateInput, setDateInput] = useState(() => dateKeyOf(entry.timestamp))
  const [timeInput, setTimeInput] = useState(() => timeKeyOf(entry.timestamp))

  const editedTimestamp = timestampFromInputs(dateInput, timeInput, entry.timestamp)
  // Only a changed date is checked against the clock, so an entry stamped by
  // a device whose clock runs slightly ahead can still be edited.
  const dateError =
    editedTimestamp == null
      ? 'Pick a date and time.'
      : editedTimestamp !== entry.timestamp && editedTimestamp > Date.now()
        ? "The date and time can't be in the future."
        : null

  function startEdit() {
    setType(entry.type)
    setAmount(entry.amount)
    setNote(entry.note)
    setDateInput(dateKeyOf(entry.timestamp))
    setTimeInput(timeKeyOf(entry.timestamp))
    setIsEditing(true)
  }

  function handleSave() {
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid amount', 'error')
      return
    }
    if (editedTimestamp == null || dateError != null) return
    updateCashEntry(entry.id, { type, amount, note, timestamp: editedTimestamp })
    const movedToOtherDay = dateKeyOf(editedTimestamp) !== dateKeyOf(entry.timestamp)
    showToast(movedToOtherDay ? `Entry moved to ${formatDate(editedTimestamp)}` : 'Entry updated')
    setIsEditing(false)
  }

  function handleDelete() {
    deleteCashEntry(entry.id)
    showToast('Entry deleted')
  }

  if (isEditing) {
    return (
      <div className="cash-entry-row cash-entry-row--editing">
        <div className="cash-entry-row__fields">
          <div className="field">
            <label htmlFor={`cash-type-${entry.id}`}>Type</label>
            <select
              id={`cash-type-${entry.id}`}
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
            <label htmlFor={`cash-amount-${entry.id}`}>Amount</label>
            <input
              id={`cash-amount-${entry.id}`}
              className="num"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={`cash-note-${entry.id}`}>Note</label>
            <input
              id={`cash-note-${entry.id}`}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DateTimeFields
          idPrefix={`cash-${entry.id}`}
          date={dateInput}
          time={timeInput}
          onDateChange={setDateInput}
          onTimeChange={setTimeInput}
        />
        {dateError != null && (
          <div className="cash-entry-row__date-error" role="alert">
            {dateError}
          </div>
        )}
        <div className="cash-entry-row__actions">
          <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={dateError != null}>
            Save
          </button>
        </div>
      </div>
    )
  }

  const isCredit = CASH_IN_TYPES.includes(entry.type)

  return (
    <div className="cash-entry-row">
      <div className="cash-entry-row__main">
        <div className="cash-entry-row__top">
          <span className="cash-entry-row__label">{CASH_ENTRY_TYPE_LABELS[entry.type]}</span>
          <span className={`num ${isCredit ? 'amount-credit' : 'amount-debit'}`}>
            {formatCurrency(entry.amount)}
          </span>
        </div>
        <div className="cash-entry-row__meta">
          <span>{formatDateTime(entry.timestamp)}</span>
          {entry.note !== '' && <span className="cash-entry-row__note">{entry.note}</span>}
        </div>
      </div>
      <div className="cash-entry-row__actions">
        <button type="button" className="btn-icon" aria-label="Edit entry" onClick={startEdit}>
          ✎
        </button>
        <ConfirmButton
          variant="icon"
          label="Delete entry"
          title="Delete cash entry?"
          details={
            <>
              <strong>{CASH_ENTRY_TYPE_LABELS[entry.type]}</strong>
              <span className="num">{formatCurrency(entry.amount)}</span>
              <span>{formatDateTime(entry.timestamp)}</span>
              {entry.note !== '' && <span>{entry.note}</span>}
            </>
          }
          message="Cash drawer and loan totals will be recalculated. This can't be undone."
          onConfirm={handleDelete}
        />
      </div>
    </div>
  )
}
