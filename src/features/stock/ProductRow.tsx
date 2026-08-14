import type { Product, Transaction } from '../../types'
import { getProductAggregates } from '../../lib/calculations'
import { formatCurrency, formatQtyWithUnit } from '../../lib/format'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmButton } from '../../components/common/ConfirmButton'
import { StatCard } from '../../components/common/StatCard'
import { TransactionRow } from '../../components/common/TransactionRow'

interface ProductRowProps {
  product: Product
  transactions: Transaction[]
  isExpanded: boolean
  onToggle: () => void
}

/** One product's summary row, expandable into its full detail panel (all-time totals, profit, own transaction history, delete). */
export function ProductRow({ product, transactions, isExpanded, onToggle }: ProductRowProps) {
  const { deleteProduct } = useAppData()
  const { showToast } = useToast()

  const isWeight = product.measurementType === 'weight'
  const aggregates = getProductAggregates(product.id, transactions)
  const stockValue = product.stock * product.avgCost
  const profitIsPositive = aggregates.totalProfit >= 0

  function handleDelete() {
    deleteProduct(product.id)
    showToast('Product deleted')
  }

  const ownTransactions = transactions
    .filter((t) => t.productId === product.id)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className={`card product-row ${isExpanded ? 'is-expanded' : ''}`}>
      <button type="button" className="product-row__header" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="product-row__main">
          <div className="product-row__title">
            <span className="product-row__name">{product.name}</span>
            <span className={`badge ${isWeight ? 'badge-weight' : 'badge-count'}`}>
              {isWeight ? 'Weight' : product.unit}
            </span>
          </div>
          <div className="product-row__stats">
            <span className="num">{formatQtyWithUnit(product.stock, product.unit)}</span>
            <span className="num">Avg {formatCurrency(product.avgCost)}</span>
            <span className="num">Value {formatCurrency(stockValue)}</span>
            {isWeight && (
              <span className="num">Deducted {formatQtyWithUnit(aggregates.totalDeduction, product.unit)}</span>
            )}
          </div>
        </div>
        <div className="product-row__right">
          <span className={`num product-row__profit ${profitIsPositive ? 'amount-profit' : 'amount-loss'}`}>
            {formatCurrency(aggregates.totalProfit)}
          </span>
          <span className="product-row__caret" aria-hidden="true">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="product-row__detail">
          <div className="product-row__detail-lines">
            <p className="num">
              Bought {formatQtyWithUnit(aggregates.totalBoughtQty, product.unit)} for{' '}
              {formatCurrency(aggregates.totalPurchaseCost)}
            </p>
            <p className="num">
              Sold {formatQtyWithUnit(aggregates.totalSoldQty, product.unit)} for{' '}
              {formatCurrency(aggregates.totalSaleRevenue)}
            </p>
          </div>

          <StatCard
            label={profitIsPositive ? 'Total Profit' : 'Total Loss'}
            value={formatCurrency(aggregates.totalProfit)}
            tone={profitIsPositive ? 'positive' : 'negative'}
          />

          <div className="stack product-row__transactions">
            <div className="section-title">Transactions</div>
            {ownTransactions.length === 0 ? (
              <p className="empty-state">No transactions yet for this product.</p>
            ) : (
              ownTransactions.map((t) => <TransactionRow key={t.id} transaction={t} />)
            )}
          </div>

          <div className="product-row__delete">
            <p className="product-row__delete-note">
              Deleting this product also removes all of its transaction history. This can't be undone.
            </p>
            <ConfirmButton variant="button" label="Delete Product" onConfirm={handleDelete} />
          </div>
        </div>
      )}
    </div>
  )
}
