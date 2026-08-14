import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { StatCard } from '../../components/common/StatCard'
import {
  computeCashSummary,
  getLowStockProducts,
  getMostValuableStock,
  getStockValue,
  getTradingProfit,
} from '../../lib/calculations'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../lib/constants'
import { formatCurrency, formatQtyWithUnit } from '../../lib/format'
import './ReportTab.css'

export default function ReportTab() {
  const { products, transactions, cashEntries } = useAppData()
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD)

  const cashSummary = computeCashSummary(cashEntries, transactions)
  const stockValue = getStockValue(products)
  const tradingProfit = getTradingProfit(transactions)
  const netProfit = tradingProfit - cashSummary.totalExpenses

  const lowStockProducts = getLowStockProducts(products, threshold)
  const mostValuable = getMostValuableStock(products, 5)
  const topValue = mostValuable[0]?.value ?? 0

  function handleThresholdChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.valueAsNumber
    setThreshold(Number.isNaN(value) ? 0 : value)
  }

  return (
    <div className="stack report-tab">
      <div
        className={`card report-headline ${netProfit >= 0 ? 'report-headline-positive' : 'report-headline-negative'}`}
      >
        <div className="report-headline-label">Net Profit (after expenses)</div>
        <div className="report-headline-value num">{formatCurrency(netProfit)}</div>
      </div>

      <div className="report-stat-grid">
        <StatCard label="Total Sales" value={formatCurrency(cashSummary.totalSales)} />
        <StatCard label="Total Purchases" value={formatCurrency(cashSummary.totalPurchases)} />
        <StatCard
          label="Trading Profit"
          value={formatCurrency(tradingProfit)}
          tone={tradingProfit >= 0 ? 'positive' : 'negative'}
        />
        <StatCard label="Stock Value" value={formatCurrency(stockValue)} />
        <StatCard label="Total Expenses" value={formatCurrency(cashSummary.totalExpenses)} />
        <StatCard
          label="You Owe"
          value={formatCurrency(cashSummary.youOwe)}
          tone={cashSummary.youOwe > 0 ? 'negative' : 'default'}
        />
        <StatCard
          label="Owed to You"
          value={formatCurrency(cashSummary.owedToYou)}
          tone={cashSummary.owedToYou > 0 ? 'positive' : 'default'}
        />
      </div>

      <section className="card">
        <div className="report-section-header">
          <h2 className="section-title">Low Stock</h2>
          <div className="field report-threshold-field">
            <label htmlFor="low-stock-threshold">Threshold</label>
            <input
              id="low-stock-threshold"
              type="number"
              className="num"
              min={0}
              step="any"
              value={threshold}
              onChange={handleThresholdChange}
            />
          </div>
        </div>
        {lowStockProducts.length === 0 ? (
          <div className="empty-state">No products at or below this threshold</div>
        ) : (
          <ul className="report-list">
            {lowStockProducts.map((product) => (
              <li key={product.id} className="report-list-row">
                <span className="report-list-name">{product.name}</span>
                <span className="num report-list-stock">{formatQtyWithUnit(product.stock, product.unit)}</span>
                <span className="num report-list-cost">{formatCurrency(product.avgCost)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Most Valuable Stock</h2>
        {mostValuable.length === 0 ? (
          <div className="empty-state">No products yet</div>
        ) : (
          <ul className="report-bar-list">
            {mostValuable.map(({ product, value }) => (
              <li key={product.id} className="report-bar-row">
                <div className="report-bar-row-top">
                  <span className="report-bar-name">{product.name}</span>
                  <span className="num report-bar-value">{formatCurrency(value)}</span>
                </div>
                <div className="report-bar-track">
                  <div
                    className="report-bar-fill"
                    style={{ width: `${topValue > 0 ? (value / topValue) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
