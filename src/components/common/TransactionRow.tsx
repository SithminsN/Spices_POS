import { useState } from 'react'
import type { Transaction, TransactionType } from '../../types'
import { getLowestStockPoint } from '../../lib/calculations'
import {
  dateKeyOf,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatQty,
  formatQtyWithUnit,
  timeKeyOf,
  timestampFromInputs,
} from '../../lib/format'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmButton } from './ConfirmButton'
import { DateTimeFields } from './DateTimeFields'
import './TransactionRow.css'

interface TransactionRowProps {
  transaction: Transaction
}

/**
 * Single transaction row with an inline view/edit toggle. Fully
 * self-sufficient (reads/writes via useAppData + useToast itself) so it can
 * be reused unmodified on the Ledger tab, a product's detail panel on the
 * Stock tab, and the Daily tab's combined per-day list.
 */
export function TransactionRow({ transaction }: TransactionRowProps) {
  const { products, transactions, updateTransaction, deleteTransaction } = useAppData()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [type, setType] = useState<TransactionType>(transaction.type)
  const [price, setPrice] = useState(transaction.price)
  const [note, setNote] = useState(transaction.note)
  const [grossQty, setGrossQty] = useState(transaction.grossQty ?? transaction.netQty)
  const [netQty, setNetQty] = useState(transaction.netQty)
  const [netTouched, setNetTouched] = useState(false)
  const [dateInput, setDateInput] = useState(() => dateKeyOf(transaction.timestamp))
  const [timeInput, setTimeInput] = useState(() => timeKeyOf(transaction.timestamp))

  const isWeight = transaction.measurementType === 'weight'

  const editedTimestamp = timestampFromInputs(dateInput, timeInput, transaction.timestamp)
  const isMoved = editedTimestamp != null && editedTimestamp !== transaction.timestamp
  // Only a changed date is checked against the clock, so a record stamped by
  // a device whose clock runs slightly ahead can still be edited.
  const dateError =
    editedTimestamp == null
      ? 'Pick a date and time.'
      : isMoved && editedTimestamp > Date.now()
        ? "The date and time can't be in the future."
        : null
  // Same rule as the Entry tab: a cleared number input reads as 0, which
  // would otherwise save a 0 kg / Rs. 0 transaction.
  const isPositive = (value: number) => Number.isFinite(value) && value > 0
  const amountError =
    !isPositive(netQty) || (isWeight && !isPositive(grossQty)) || !isPositive(price)
      ? 'Quantity and price must be more than zero.'
      : null

  function startEdit() {
    setType(transaction.type)
    setPrice(transaction.price)
    setNote(transaction.note)
    setGrossQty(transaction.grossQty ?? transaction.netQty)
    setNetQty(transaction.netQty)
    setDateInput(dateKeyOf(transaction.timestamp))
    setTimeInput(timeKeyOf(transaction.timestamp))
    // If this transaction already has a real recorded deduction, treat net
    // as already intentionally set so editing gross (e.g. fixing a typo)
    // doesn't silently overwrite it -- only a brand-new gross===net entry
    // should get the "net follows gross" convenience.
    setNetTouched(transaction.grossQty != null && transaction.grossQty !== transaction.netQty)
    setIsEditing(true)
  }

  function handleGrossChange(value: number) {
    setGrossQty(value)
    if (!netTouched) setNetQty(value)
  }

  function handleNetChange(value: number) {
    setNetQty(value)
    setNetTouched(true)
  }

  function handleSave() {
    if (editedTimestamp == null || dateError != null || amountError != null) return
    updateTransaction(transaction.id, {
      type,
      productId: transaction.productId,
      grossQty: isWeight ? grossQty : null,
      netQty,
      price,
      note,
      timestamp: editedTimestamp,
    })
    // A transaction moved to another day leaves the list it was edited in
    // (e.g. Recent Transactions), so say where it went.
    const movedToOtherDay = dateKeyOf(editedTimestamp) !== dateKeyOf(transaction.timestamp)
    showToast(movedToOtherDay ? `Transaction moved to ${formatDate(editedTimestamp)}` : 'Transaction updated')
    setIsEditing(false)
  }

  function handleDelete() {
    deleteTransaction(transaction.id)
    showToast('Transaction deleted')
  }

  if (isEditing) {
    const product = products.find((p) => p.id === transaction.productId)
    const deduction = isWeight ? grossQty - netQty : 0

    // Replay this product's history with the edit applied, in date order, and
    // warn only if the edit makes stock dip lower than it already does.
    let negativePoint: { stock: number; timestamp: number | null } | null = null
    if (product) {
      const edited: Transaction = { ...transaction, type, netQty, timestamp: editedTimestamp ?? transaction.timestamp }
      const before = getLowestStockPoint(product, transactions)
      const after = getLowestStockPoint(
        product,
        transactions.map((t) => (t.id === transaction.id ? edited : t)),
      )
      if (after.stock < 0 && after.stock < before.stock) negativePoint = after
    }

    return (
      <div className="txn-row txn-row--editing">
        <div className="txn-row__type-toggle">
          <button
            type="button"
            className={`chip ${type === 'buy' ? 'is-active' : ''}`}
            onClick={() => setType('buy')}
          >
            Purchase
          </button>
          <button
            type="button"
            className={`chip ${type === 'sell' ? 'is-active' : ''}`}
            onClick={() => setType('sell')}
          >
            Sale
          </button>
        </div>

        <DateTimeFields
          idPrefix={`txn-${transaction.id}`}
          date={dateInput}
          time={timeInput}
          onDateChange={setDateInput}
          onTimeChange={setTimeInput}
        />
        {dateError != null ? (
          <div className="txn-row__date-note txn-row__date-note--error" role="alert">
            {dateError}
          </div>
        ) : (
          isMoved &&
          editedTimestamp != null && (
            <div className="txn-row__date-note">
              Moves to {formatDateTime(editedTimestamp)}. Stock, average cost and profit for{' '}
              {transaction.productName} are recalculated in date order.
            </div>
          )
        )}

        <div className="txn-row__fields">
          {isWeight ? (
            <>
              <div className="field">
                <label htmlFor={`txn-gross-${transaction.id}`}>Gross ({transaction.unit})</label>
                <input
                  id={`txn-gross-${transaction.id}`}
                  className="num"
                  type="number"
                  min={0}
                  step="0.001"
                  value={grossQty}
                  onChange={(e) => handleGrossChange(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor={`txn-net-${transaction.id}`}>Net ({transaction.unit})</label>
                <input
                  id={`txn-net-${transaction.id}`}
                  className="num"
                  type="number"
                  min={0}
                  step="0.001"
                  value={netQty}
                  onChange={(e) => handleNetChange(Number(e.target.value))}
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor={`txn-qty-${transaction.id}`}>Quantity ({transaction.unit})</label>
              <input
                id={`txn-qty-${transaction.id}`}
                className="num"
                type="number"
                min={0}
                step="1"
                value={netQty}
                onChange={(e) => handleNetChange(Number(e.target.value))}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={`txn-price-${transaction.id}`}>Price / unit</label>
            <input
              id={`txn-price-${transaction.id}`}
              className="num"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
        </div>

        {isWeight && deduction > 0 && (
          <div className="txn-row__deduction num">Deduction: {formatQty(deduction)} {transaction.unit}</div>
        )}

        {amountError != null && (
          <div className="txn-row__error" role="alert">
            {amountError}
          </div>
        )}

        <div className="field">
          <label htmlFor={`txn-note-${transaction.id}`}>Note</label>
          <input
            id={`txn-note-${transaction.id}`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {negativePoint && product && (
          <div className="txn-row__warning">
            This takes {product.name} stock below zero
            {negativePoint.timestamp != null && <> on {formatDateTime(negativePoint.timestamp)}</>} (
            <span className="num">{formatQtyWithUnit(negativePoint.stock, product.unit)}</span>)
          </div>
        )}

        <div className="txn-row__actions txn-row__actions--edit">
          <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={dateError != null || amountError != null}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  const isSell = transaction.type === 'sell'
  const showsDeductedQty = isWeight && transaction.grossQty != null && transaction.grossQty !== transaction.netQty
  const qtyText = showsDeductedQty
    ? `${formatQty(transaction.grossQty as number)} → ${formatQty(transaction.netQty)} ${transaction.unit}`
    : formatQtyWithUnit(transaction.netQty, transaction.unit)

  return (
    <div className="txn-row">
      <div className="txn-row__main">
        <div className="txn-row__top">
          <span className="txn-row__badges">
            <span
              className={`badge txn-row__type ${
                isSell ? 'txn-row__type--sell amount-credit' : 'txn-row__type--buy amount-debit'
              }`}
            >
              {isSell ? 'Sale' : 'Purchase'}
            </span>
            <span className="txn-row__product">{transaction.productName}</span>
          </span>
          <span className={`num txn-row__total ${isSell ? 'amount-credit' : 'amount-debit'}`}>
            {formatCurrency(transaction.total)}
          </span>
        </div>
        <div className="txn-row__meta">
          <span className="num">{qtyText}</span>
          <span className="num">
            {formatCurrency(transaction.price)} / {transaction.unit}
          </span>
          <span>{formatDateTime(transaction.timestamp)}</span>
          {isSell && transaction.profit != null && (
            <span className={`num ${transaction.profit >= 0 ? 'amount-profit' : 'amount-loss'}`}>
              Profit: {formatCurrency(transaction.profit)}
            </span>
          )}
        </div>
        {transaction.note !== '' && <div className="txn-row__note">{transaction.note}</div>}
      </div>
      <div className="txn-row__actions">
        <button type="button" className="btn-icon" aria-label="Edit transaction" onClick={startEdit}>
          ✎
        </button>
        <ConfirmButton
          variant="icon"
          label="Delete transaction"
          title="Delete transaction?"
          details={
            <>
              <strong>
                {isSell ? 'Sale' : 'Purchase'} · {transaction.productName}
              </strong>
              <span className="num">
                {qtyText} · {formatCurrency(transaction.total)}
              </span>
              <span>{formatDateTime(transaction.timestamp)}</span>
              {transaction.note !== '' && <span>{transaction.note}</span>}
            </>
          }
          message={`Stock, average cost and profit for ${transaction.productName} will be recalculated. This can't be undone.`}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  )
}
