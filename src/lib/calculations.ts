// All business math lives here. Every formula in this file mirrors a
// formula documented in docs/BUSINESS_LOGIC.md — keep them in sync.
import { CASH_IN_TYPES, CASH_OUT_TYPES } from './constants'
import { dateKeyOf } from './format'
import type { CashEntry, CashSummary, DayGroup, Product, ProductAggregates, Transaction } from '../types'

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const roundMoney = (v: number) => round(v, 2)
const roundQty = (v: number) => round(v, 3)
const roundCost = (v: number) => round(v, 4)

/**
 * Recomputes a product's stock/avgCost, and the profit on each of its sale
 * transactions, by replaying that product's transactions in chronological
 * order starting from its opening stock/cost.
 *
 * Replaying from scratch (rather than trying to "undo" a single edited
 * transaction with inverse arithmetic) is what makes add/edit/delete safe:
 * there is only ever one code path that derives stock, avgCost and profit,
 * so they can never drift out of sync with the transaction list. See
 * docs/BUSINESS_LOGIC.md "Recalculation strategy".
 *
 * Returns the updated product and the full transaction array passed in,
 * with this product's own transactions replaced by recomputed copies
 * (other products' transactions are returned untouched, same order).
 */
export function recomputeProduct(
  product: Product,
  allTransactions: Transaction[],
): { product: Product; transactions: Transaction[] } {
  const ownSorted = allTransactions
    .filter((t) => t.productId === product.id)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))

  let stock = product.openingStock
  let avgCost = product.openingCost
  const recomputed = new Map<string, Transaction>()

  for (const t of ownSorted) {
    const total = roundMoney(t.netQty * t.price)
    if (t.type === 'buy') {
      const newStock = stock + t.netQty
      avgCost = newStock === 0 ? avgCost : (stock * avgCost + t.netQty * t.price) / newStock
      stock = newStock
      recomputed.set(t.id, { ...t, total, profit: null })
    } else {
      const profit = roundMoney((t.price - avgCost) * t.netQty)
      stock = stock - t.netQty
      recomputed.set(t.id, { ...t, total, profit })
    }
  }

  const transactions = allTransactions.map((t) => recomputed.get(t.id) ?? t)
  const updatedProduct: Product = {
    ...product,
    stock: roundQty(stock),
    avgCost: roundCost(avgCost),
    updatedAt: Date.now(),
  }
  return { product: updatedProduct, transactions }
}

/** True if selling `netQty` of `product` would take its stock below zero. */
export function wouldGoNegative(product: Product, netQty: number): boolean {
  return product.stock - netQty < 0
}

export function getProductAggregates(productId: string, transactions: Transaction[]): ProductAggregates {
  const aggregates: ProductAggregates = {
    totalBoughtQty: 0,
    totalPurchaseCost: 0,
    totalSoldQty: 0,
    totalSaleRevenue: 0,
    totalProfit: 0,
    totalDeduction: 0,
  }
  for (const t of transactions) {
    if (t.productId !== productId) continue
    if (t.grossQty != null) {
      aggregates.totalDeduction = roundQty(aggregates.totalDeduction + (t.grossQty - t.netQty))
    }
    if (t.type === 'buy') {
      aggregates.totalBoughtQty = roundQty(aggregates.totalBoughtQty + t.netQty)
      aggregates.totalPurchaseCost = roundMoney(aggregates.totalPurchaseCost + t.total)
    } else {
      aggregates.totalSoldQty = roundQty(aggregates.totalSoldQty + t.netQty)
      aggregates.totalSaleRevenue = roundMoney(aggregates.totalSaleRevenue + t.total)
      aggregates.totalProfit = roundMoney(aggregates.totalProfit + (t.profit ?? 0))
    }
  }
  return aggregates
}

export function getStockValue(products: Product[]): number {
  return roundMoney(products.reduce((sum, p) => sum + p.stock * p.avgCost, 0))
}

/** Sum of the stored `profit` field across all sale transactions. */
export function getTradingProfit(transactions: Transaction[]): number {
  return roundMoney(transactions.reduce((sum, t) => (t.type === 'sell' ? sum + (t.profit ?? 0) : sum), 0))
}

export function getMostValuableStock(
  products: Product[],
  limit?: number,
): Array<{ product: Product; value: number }> {
  const ranked = products
    .map((product) => ({ product, value: roundMoney(product.stock * product.avgCost) }))
    .sort((a, b) => b.value - a.value)
  return limit != null ? ranked.slice(0, limit) : ranked
}

export function getLowStockProducts(products: Product[], threshold: number): Product[] {
  return products.filter((p) => p.stock <= threshold).sort((a, b) => a.stock - b.stock)
}

/**
 * Cash Drawer balance = (total sales - total purchases) + capital in +
 * loans in - loan repayments - expenses - loans out + loan-out repayments.
 * See docs/BUSINESS_LOGIC.md "Cash drawer formula".
 */
export function computeCashSummary(cashEntries: CashEntry[], transactions: Transaction[]): CashSummary {
  const totals = {
    totalSales: 0,
    totalPurchases: 0,
    totalCapitalIn: 0,
    totalLoanIn: 0,
    totalLoanInRepay: 0,
    totalLoanOut: 0,
    totalLoanOutRepay: 0,
    totalExpenses: 0,
  }

  for (const t of transactions) {
    if (t.type === 'sell') totals.totalSales += t.total
    else totals.totalPurchases += t.total
  }

  for (const c of cashEntries) {
    switch (c.type) {
      case 'capital_in':
        totals.totalCapitalIn += c.amount
        break
      case 'loan_in':
        totals.totalLoanIn += c.amount
        break
      case 'loan_in_repay':
        totals.totalLoanInRepay += c.amount
        break
      case 'loan_out':
        totals.totalLoanOut += c.amount
        break
      case 'loan_out_repay':
        totals.totalLoanOutRepay += c.amount
        break
      case 'expense':
        totals.totalExpenses += c.amount
        break
    }
  }

  const cashDrawer =
    totals.totalSales -
    totals.totalPurchases +
    totals.totalCapitalIn +
    totals.totalLoanIn -
    totals.totalLoanInRepay -
    totals.totalExpenses -
    totals.totalLoanOut +
    totals.totalLoanOutRepay

  return {
    ...totals,
    cashDrawer: roundMoney(cashDrawer),
    youOwe: roundMoney(Math.max(0, totals.totalLoanIn - totals.totalLoanInRepay)),
    owedToYou: roundMoney(Math.max(0, totals.totalLoanOut - totals.totalLoanOutRepay)),
  }
}

/**
 * Groups transactions and cash entries by local calendar day, most recent
 * day first, with each day's own entries sorted chronologically (ascending).
 * `cashIn`/`cashOut` on each group cover cash-ledger entries only (capital,
 * loans, expenses); trade totals are exposed separately as
 * totalSales/totalPurchases so the two mini stat cards don't double count.
 * `netCashFlow` combines both for the day's single headline number.
 */
export function computeDayGroups(transactions: Transaction[], cashEntries: CashEntry[]): DayGroup[] {
  const groups = new Map<string, DayGroup>()

  const ensureGroup = (timestamp: number): DayGroup => {
    const dateKey = dateKeyOf(timestamp)
    let group = groups.get(dateKey)
    if (!group) {
      const anchor = new Date(timestamp)
      anchor.setHours(0, 0, 0, 0)
      group = {
        dateKey,
        timestamp: anchor.getTime(),
        transactions: [],
        cashEntries: [],
        totalSales: 0,
        totalPurchases: 0,
        totalProfit: 0,
        cashIn: 0,
        cashOut: 0,
        netCashFlow: 0,
        totalWeightDeducted: 0,
        entryCount: 0,
      }
      groups.set(dateKey, group)
    }
    return group
  }

  for (const t of transactions) {
    const group = ensureGroup(t.timestamp)
    group.transactions.push(t)
    group.entryCount += 1
    if (t.type === 'sell') {
      group.totalSales = roundMoney(group.totalSales + t.total)
      group.totalProfit = roundMoney(group.totalProfit + (t.profit ?? 0))
    } else {
      group.totalPurchases = roundMoney(group.totalPurchases + t.total)
    }
    if (t.grossQty != null) {
      group.totalWeightDeducted = roundQty(group.totalWeightDeducted + (t.grossQty - t.netQty))
    }
  }

  for (const c of cashEntries) {
    const group = ensureGroup(c.timestamp)
    group.cashEntries.push(c)
    group.entryCount += 1
    if (CASH_IN_TYPES.includes(c.type)) group.cashIn = roundMoney(group.cashIn + c.amount)
    else if (CASH_OUT_TYPES.includes(c.type)) group.cashOut = roundMoney(group.cashOut + c.amount)
  }

  const result = Array.from(groups.values())
  for (const group of result) {
    group.transactions.sort((a, b) => a.timestamp - b.timestamp)
    group.cashEntries.sort((a, b) => a.timestamp - b.timestamp)
    group.netCashFlow = roundMoney(
      group.totalSales - group.totalPurchases + group.cashIn - group.cashOut,
    )
  }
  result.sort((a, b) => b.timestamp - a.timestamp)
  return result
}
