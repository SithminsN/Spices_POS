import { useMemo, useState } from 'react'
import type { TransactionType } from '../../types'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ProductPicker } from '../../components/common/ProductPicker'
import { TransactionRow } from '../../components/common/TransactionRow'
import { getPurchasesOnDay, wouldGoNegative } from '../../lib/calculations'
import { dateKeyOf, formatCurrency, formatQty, formatQtyWithUnit } from '../../lib/format'
import './EntryTab.css'

/** Empty string means "not entered yet"; anything else must be a positive number to count as valid. */
function parsePositiveNumber(value: string): number | null {
  const n = Number(value)
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

export default function EntryTab() {
  const { products, transactions, addTransaction } = useAppData()
  const { showToast } = useToast()

  const [type, setType] = useState<TransactionType>('buy')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const [grossInput, setGrossInput] = useState('')
  const [netInput, setNetInput] = useState('')
  const [netTouched, setNetTouched] = useState(false)
  const [qtyInput, setQtyInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [note, setNote] = useState('')

  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId) ?? null
    : null
  const isWeight = selectedProduct?.measurementType === 'weight'

  const grossQty = parsePositiveNumber(grossInput)
  const netQty = parsePositiveNumber(netInput)
  const qty = parsePositiveNumber(qtyInput)
  const price = parsePositiveNumber(priceInput)
  const effectiveNetQty = isWeight ? netQty : qty

  const rawNetQty = isWeight ? Number(netInput) : Number(qtyInput)
  const rawPrice = Number(priceInput)
  const total = Number.isFinite(rawNetQty) && Number.isFinite(rawPrice) ? rawNetQty * rawPrice : 0

  // Deduction must use the validated (null-if-empty) quantities, not the raw
  // inputs -- Number('') is 0, which would show a phantom "deduction" while
  // the net field is simply not filled in yet.
  const deduction = isWeight && grossQty != null && netQty != null ? grossQty - netQty : 0

  const showsNegativeWarning =
    type === 'sell' && selectedProduct != null && effectiveNetQty != null && wouldGoNegative(selectedProduct, effectiveNetQty)

  const canSave =
    selectedProduct != null && effectiveNetQty != null && price != null && (!isWeight || grossQty != null)

  const recentTransactions = useMemo(
    () => transactions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [transactions],
  )

  // todayKey is a dependency so the figures roll over at midnight on the next render.
  const todayKey = dateKeyOf(Date.now())
  const todayPurchases = useMemo(() => getPurchasesOnDay(transactions, todayKey), [transactions, todayKey])

  function resetEntryFields() {
    setGrossInput('')
    setNetInput('')
    setNetTouched(false)
    setQtyInput('')
    setPriceInput('')
    setNote('')
  }

  function handleSelectProduct(productId: string) {
    setSelectedProductId(productId)
    resetEntryFields()
  }

  function handleGrossChange(value: string) {
    setGrossInput(value)
    if (!netTouched) setNetInput(value)
  }

  function handleNetChange(value: string) {
    setNetInput(value)
    setNetTouched(true)
  }

  function handleSave() {
    if (!selectedProduct || effectiveNetQty == null || price == null) return
    if (isWeight && grossQty == null) return
    // isWeight implies grossQty is non-null at this point (guarded above); TS can't
    // narrow across the two separate variables, so assert explicitly.
    const finalGrossQty = isWeight ? (grossQty as number) : null
    addTransaction({
      type,
      productId: selectedProduct.id,
      grossQty: finalGrossQty,
      netQty: effectiveNetQty,
      price,
      note: note.trim(),
    })
    showToast(type === 'sell' ? 'Sale recorded' : 'Purchase recorded')
    resetEntryFields()
  }

  return (
    <div className="entry-tab">
      <div className="card entry-tab__form">
        <div className="section-title">New Entry</div>

        <div className="entry-tab__toggle" role="group" aria-label="Transaction type">
          <button type="button" className={`chip ${type === 'buy' ? 'is-active' : ''}`} onClick={() => setType('buy')}>
            Purchase
          </button>
          <button type="button" className={`chip ${type === 'sell' ? 'is-active' : ''}`} onClick={() => setType('sell')}>
            Sale
          </button>
        </div>

        <div className="field">
          <label>Product</label>
          <ProductPicker
            products={products}
            todayPurchases={todayPurchases}
            selectedProductId={selectedProductId}
            onSelect={handleSelectProduct}
          />
        </div>

        {selectedProduct && (
          <>
            {isWeight ? (
              <div className="entry-tab__qty-fields">
                <div className="field">
                  <label htmlFor="entry-gross">Gross weight ({selectedProduct.unit})</label>
                  <input
                    id="entry-gross"
                    className="num"
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    placeholder="0"
                    value={grossInput}
                    onChange={(e) => handleGrossChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="entry-net">Net weight ({selectedProduct.unit})</label>
                  <input
                    id="entry-net"
                    className="num"
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    placeholder="0"
                    value={netInput}
                    onChange={(e) => handleNetChange(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="entry-qty">Quantity ({selectedProduct.unit})</label>
                <input
                  id="entry-qty"
                  className="num"
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  placeholder="0"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                />
              </div>
            )}

            {isWeight && deduction > 0 && (
              <div className="entry-tab__deduction num">
                Deduction: {formatQty(deduction)} {selectedProduct.unit}
              </div>
            )}

            <div className="field">
              <label htmlFor="entry-price">Price / {selectedProduct.unit}</label>
              <input
                id="entry-price"
                className="num"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="entry-note">Note (optional)</label>
              <input
                id="entry-note"
                type="text"
                placeholder="Customer / supplier name"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {showsNegativeWarning && (
              <div className="entry-tab__warning">
                This sale will take stock below zero (current stock:{' '}
                <span className="num">{formatQtyWithUnit(selectedProduct.stock, selectedProduct.unit)}</span>)
              </div>
            )}

            <div className="entry-tab__total">
              <span className="entry-tab__total-label">Total</span>
              <span className={`entry-tab__total-value num ${type === 'sell' ? 'amount-credit' : 'amount-debit'}`}>
                {formatCurrency(total)}
              </span>
            </div>

            <button type="button" className="btn btn-primary btn-block" disabled={!canSave} onClick={handleSave}>
              Save {type === 'sell' ? 'Sale' : 'Purchase'}
            </button>
          </>
        )}
      </div>

      <div className="entry-tab__recent">
        <div className="section-title">Recent Transactions</div>
        {recentTransactions.length === 0 ? (
          <p className="empty-state">No transactions yet.</p>
        ) : (
          <div className="stack">
            {recentTransactions.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
