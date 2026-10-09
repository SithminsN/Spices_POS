import type { DateRange, Product, Transaction } from '../../types'
import { getHistoryStart, getProductPeriodSummary, isInRange } from '../../lib/calculations'
import { formatCurrency, formatDate, formatQtyWithUnit } from '../../lib/format'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmButton } from '../../components/common/ConfirmButton'
import { StatCard } from '../../components/common/StatCard'
import { TransactionRow } from '../../components/common/TransactionRow'

const ALL_TIME: DateRange = { start: null, endExclusive: null }

interface ProductRowProps {
  product: Product
  transactions: Transaction[]
  /** The Stock tab's date filter; null means all time. */
  range: DateRange | null
  isExpanded: boolean
  onToggle: () => void
}

/**
 * One product's summary row, expandable into its detail panel (stock
 * movement, profit, own transaction history, delete). With a date filter,
 * stock/avg/value are as at the end of the range and the movement, profit
 * and transactions cover only the range.
 */
export function ProductRow({ product, transactions, range, isExpanded, onToggle }: ProductRowProps) {
  const { deleteProduct } = useAppData()
  const { showToast } = useToast()

  const isWeight = product.measurementType === 'weight'
  const isFiltered = range != null
  const summary = getProductPeriodSummary(product, transactions, range ?? ALL_TIME)
  const profitIsPositive = summary.profit >= 0

  // Unfiltered keeps the stored figures (same as the Entry and Report tabs);
  // filtered shows the replayed figures as at the end of the range.
  const shownStock = isFiltered ? summary.closingStock : product.stock
  const shownAvgCost = isFiltered ? summary.closingAvgCost : product.avgCost
  const shownValue = isFiltered ? summary.closingValue : product.stock * product.avgCost
  const valueLabel = range?.endExclusive != null ? `Value on ${formatDate(range.endExclusive - 1)}` : 'Stock value'

  // A transaction can be back-dated before the product was added; the
  // opening stock is then the starting balance before that history.
  const historyStart = getHistoryStart(product, transactions)
  const openingNote =
    range?.start != null && historyStart < range.start
      ? `start of ${formatDate(range.start)}`
      : historyStart < product.createdAt
        ? 'starting stock'
        : `when added, ${formatDate(product.createdAt)}`
  const closingNote = range?.endExclusive != null ? `end of ${formatDate(range.endExclusive - 1)}` : 'now'

  function handleDelete() {
    deleteProduct(product.id)
    showToast('Product deleted')
  }

  // All of them, regardless of the filter -- deleting the product deletes every one.
  const ownTransactions = transactions
    .filter((t) => t.productId === product.id)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
  const shownTransactions = range ? ownTransactions.filter((t) => isInRange(t.timestamp, range)) : ownTransactions

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
            <span className="num">{formatQtyWithUnit(shownStock, product.unit)}</span>
            <span className="num">Avg {formatCurrency(shownAvgCost)}</span>
            {isFiltered && (
              <>
                <span className="num">Bought {formatQtyWithUnit(summary.boughtQty, product.unit)}</span>
                <span className="num">Sold {formatQtyWithUnit(summary.soldQty, product.unit)}</span>
              </>
            )}
            {isWeight && (
              <span className="num">Deducted {formatQtyWithUnit(summary.deducted, product.unit)}</span>
            )}
          </div>
        </div>
        <div className="product-row__right">
          <span className="product-row__value-label">{valueLabel}</span>
          <span className="num product-row__value">{formatCurrency(shownValue)}</span>
          <span className="product-row__caret" aria-hidden="true">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="product-row__detail">
          <dl className="product-row__movement num">
            <div className="product-row__movement-row">
              <dt>
                Opening stock
                <span className="product-row__movement-note">{openingNote}</span>
              </dt>
              <dd>{formatQtyWithUnit(summary.openingStock, product.unit)}</dd>
            </div>
            <div className="product-row__movement-row">
              <dt>
                + Bought
                {summary.boughtQty > 0 && (
                  <span className="product-row__movement-note">avg {formatCurrency(summary.avgBuyPrice)}</span>
                )}
              </dt>
              <dd>
                {formatQtyWithUnit(summary.boughtQty, product.unit)}
                <span className="amount-debit">{formatCurrency(summary.spent)}</span>
              </dd>
            </div>
            <div className="product-row__movement-row">
              <dt>
                − Sold
                {summary.soldQty > 0 && (
                  <span className="product-row__movement-note">avg {formatCurrency(summary.avgSellPrice)}</span>
                )}
              </dt>
              <dd>
                {formatQtyWithUnit(summary.soldQty, product.unit)}
                <span className="amount-credit">{formatCurrency(summary.revenue)}</span>
              </dd>
            </div>
            <div className="product-row__movement-row product-row__movement-row--total">
              <dt>
                Closing stock
                <span className="product-row__movement-note">{closingNote}</span>
              </dt>
              <dd>{formatQtyWithUnit(summary.closingStock, product.unit)}</dd>
            </div>
          </dl>

          <StatCard
            label={`${isFiltered ? '' : 'Total '}${profitIsPositive ? 'Profit' : 'Loss'}${isFiltered ? ' in period' : ''}`}
            value={formatCurrency(summary.profit)}
            tone={profitIsPositive ? 'positive' : 'negative'}
          />

          <div className="stack product-row__transactions">
            <div className="section-title">
              {isFiltered ? 'Transactions in period' : 'Transactions'} ({shownTransactions.length})
            </div>
            {shownTransactions.length === 0 ? (
              <p className="empty-state">
                {isFiltered ? 'No transactions for this product in this period.' : 'No transactions yet for this product.'}
              </p>
            ) : (
              shownTransactions.map((t) => <TransactionRow key={t.id} transaction={t} />)
            )}
          </div>

          <div className="product-row__delete">
            <p className="product-row__delete-note">
              Deleting this product also removes all of its transaction history. This can't be undone.
            </p>
            <ConfirmButton
              variant="button"
              label="Delete Product"
              title="Delete product?"
              details={
                <>
                  <strong>{product.name}</strong>
                  <span className="num">
                    {formatQtyWithUnit(product.stock, product.unit)} in stock · {ownTransactions.length}{' '}
                    {ownTransactions.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </>
              }
              message={
                ownTransactions.length === 0
                  ? "This can't be undone."
                  : `Its ${ownTransactions.length} ${ownTransactions.length === 1 ? 'transaction' : 'transactions'} will be deleted too, so Cash, Daily and Report totals will change. This can't be undone.`
              }
              typeToConfirm={product.name}
              confirmLabel="Confirm"
              onConfirm={handleDelete}
            />
          </div>
        </div>
      )}
    </div>
  )
}
