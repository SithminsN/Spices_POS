import { useState } from 'react'
import type { Transaction, TransactionType } from '../../types'
import { wouldGoNegative } from '../../lib/calculations'
import { formatCurrency, formatDateTime, formatQty, formatQtyWithUnit } from '../../lib/format'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmButton } from './ConfirmButton'
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
  const { products, updateTransaction, deleteTransaction } = useAppData()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [type, setType] = useState<TransactionType>(transaction.type)
  const [price, setPrice] = useState(transaction.price)
  const [note, setNote] = useState(transaction.note)
  const [grossQty, setGrossQty] = useState(transaction.grossQty ?? transaction.netQty)
  const [netQty, setNetQty] = useState(transaction.netQty)
  const [netTouched, setNetTouched] = useState(false)

  const isWeight = transaction.measurementType === 'weight'

  function startEdit() {
    setType(transaction.type)
    setPrice(transaction.price)
    setNote(transaction.note)
    setGrossQty(transaction.grossQty ?? transaction.netQty)
    setNetQty(transaction.netQty)
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
    updateTransaction(transaction.id, {
      type,
      productId: transaction.productId,
      grossQty: isWeight ? grossQty : null,
      netQty,
      price,
      note,
      timestamp: transaction.timestamp,
    })
    showToast('Transaction updated')
    setIsEditing(false)
  }

  function handleDelete() {
    deleteTransaction(transaction.id)
    showToast('Transaction deleted')
  }

  if (isEditing) {
    const product = products.find((p) => p.id === transaction.productId)
    const deduction = isWeight ? grossQty - netQty : 0
    const showsNegativeWarning = type === 'sell' && product != null && wouldGoNegative(product, netQty)

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

        <div className="field">
          <label htmlFor={`txn-note-${transaction.id}`}>Note</label>
          <input
            id={`txn-note-${transaction.id}`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {showsNegativeWarning && product && (
          <div className="txn-row__warning">
            This will take stock below zero (current stock:{' '}
            <span className="num">{formatQtyWithUnit(product.stock, product.unit)}</span>)
          </div>
        )}

        <div className="txn-row__actions txn-row__actions--edit">
          <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
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
        <ConfirmButton variant="icon" onConfirm={handleDelete} />
      </div>
    </div>
  )
}
