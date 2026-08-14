// Shared domain types. This file is the single source of truth for data
// shapes across the app — see docs/SCHEMA.md for the full field-by-field
// explanation and docs/BUSINESS_LOGIC.md for how the derived fields
// (avgCost, profit, stock) are computed.

export type MeasurementType = 'weight' | 'count'

export type TransactionType = 'buy' | 'sell'

export type CashEntryType =
  | 'capital_in'
  | 'loan_in'
  | 'loan_in_repay'
  | 'loan_out'
  | 'loan_out_repay'
  | 'expense'

export interface Product {
  id: string
  name: string
  measurementType: MeasurementType
  /** 'kg' | 'g' for weight products, a custom label ("bags", "packets") for count products */
  unit: string
  /** current net/actual stock, kept in sync via recomputeProduct() */
  stock: number
  /** running weighted-average cost per unit, kept in sync via recomputeProduct() */
  avgCost: number
  openingStock: number
  openingCost: number
  createdAt: number
  updatedAt: number
}

export interface NewProductInput {
  name: string
  measurementType: MeasurementType
  unit: string
  openingStock: number
  openingCost: number
}

export interface Transaction {
  id: string
  type: TransactionType
  productId: string
  /** snapshot of the product name at creation time, survives product deletion in history */
  productName: string
  measurementType: MeasurementType
  unit: string
  /** weight-type only; null for count-type */
  grossQty: number | null
  /** net weight (weight-type) or quantity (count-type) — the value stock/cost math uses */
  netQty: number
  /** price per net unit */
  price: number
  /** netQty * price, derived and stored for display/history */
  total: number
  /** (price - avgCostAtSaleTime) * netQty for sells, null for buys */
  profit: number | null
  note: string
  timestamp: number
}

export interface TransactionInput {
  type: TransactionType
  productId: string
  grossQty: number | null
  netQty: number
  price: number
  note: string
  timestamp?: number
}

export interface CashEntry {
  id: string
  type: CashEntryType
  amount: number
  note: string
  timestamp: number
}

export interface CashEntryInput {
  type: CashEntryType
  amount: number
  note: string
  timestamp?: number
}

export interface ProductAggregates {
  totalBoughtQty: number
  totalPurchaseCost: number
  totalSoldQty: number
  totalSaleRevenue: number
  totalProfit: number
  /** sum of (grossQty - netQty) across all of this product's weight-type transactions */
  totalDeduction: number
}

export interface CashSummary {
  cashDrawer: number
  youOwe: number
  owedToYou: number
  totalSales: number
  totalPurchases: number
  totalCapitalIn: number
  totalLoanIn: number
  totalLoanInRepay: number
  totalLoanOut: number
  totalLoanOutRepay: number
  totalExpenses: number
}

/** A calendar-day bucket combining transactions and cash entries for the Daily tab. */
export interface DayGroup {
  /** yyyy-mm-dd key in local time */
  dateKey: string
  timestamp: number
  transactions: Transaction[]
  cashEntries: CashEntry[]
  totalSales: number
  totalPurchases: number
  totalProfit: number
  cashIn: number
  cashOut: number
  netCashFlow: number
  totalWeightDeducted: number
  entryCount: number
}
