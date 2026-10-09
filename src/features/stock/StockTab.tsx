import { useState } from 'react'
import type { DateRange } from '../../types'
import { useAppData } from '../../context/AppDataContext'
import { getHistoryStart } from '../../lib/calculations'
import { shiftDateKey, startOfDateKey } from '../../lib/format'
import { AddProductForm } from './AddProductForm'
import { ProductRow } from './ProductRow'
import { StockDateFilter } from './StockDateFilter'
import type { DateFilterValue } from './StockDateFilter'
import './StockTab.css'

export default function StockTab() {
  const { products, transactions } = useAppData()
  const [isAdding, setIsAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [period, setPeriod] = useState<DateFilterValue>({ from: '', to: '' })

  const isFiltered = period.from !== '' || period.to !== ''
  const isInvalid = period.from !== '' && period.to !== '' && period.from > period.to
  // Whole local days: from 00:00 on the start date up to (not including)
  // 00:00 on the day after the end date.
  const range: DateRange | null =
    isFiltered && !isInvalid
      ? {
          start: period.from ? startOfDateKey(period.from) : null,
          endExclusive: period.to ? startOfDateKey(shiftDateKey(period.to, 1)) : null,
        }
      : null

  // A product whose history (creation, or an earlier back-dated transaction)
  // starts after the period ended didn't exist in it yet.
  const endExclusive = range?.endExclusive ?? null
  const visibleProducts =
    endExclusive == null ? products : products.filter((p) => getHistoryStart(p, transactions) < endExclusive)

  function toggleExpanded(productId: string) {
    setExpandedId((current) => (current === productId ? null : productId))
  }

  return (
    <div className="stack stock-tab">
      <div className="stock-tab__header">
        <h2 className="section-title">Products</h2>
        <button type="button" className="btn btn-primary" onClick={() => setIsAdding((v) => !v)}>
          {isAdding ? 'Close' : '+ Add Product'}
        </button>
      </div>

      {isAdding && <AddProductForm onDone={() => setIsAdding(false)} />}

      {products.length > 0 && <StockDateFilter value={period} onChange={setPeriod} isInvalid={isInvalid} />}

      {products.length === 0 ? (
        <p className="empty-state">No products yet — add your first spice to start tracking stock.</p>
      ) : isInvalid ? null : visibleProducts.length === 0 ? (
        <p className="empty-state">No products had been added by the end of this period.</p>
      ) : (
        <div className="stock-tab__list">
          {visibleProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              transactions={transactions}
              range={range}
              isExpanded={expandedId === product.id}
              onToggle={() => toggleExpanded(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
