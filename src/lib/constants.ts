import type { CashEntryType } from '../types'

export const WEIGHT_UNITS = ['kg', 'g'] as const

export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export const CASH_ENTRY_TYPE_LABELS: Record<CashEntryType, string> = {
  capital_in: 'Capital In',
  loan_in: 'Loan In',
  loan_in_repay: 'Loan In Repay',
  loan_out: 'Loan Out',
  loan_out_repay: 'Loan Out Repay',
  expense: 'Expense',
}

/** Cash entry types that increase the cash drawer balance when added. */
export const CASH_IN_TYPES: CashEntryType[] = ['capital_in', 'loan_in', 'loan_out_repay']

/** Cash entry types that decrease the cash drawer balance when added. */
export const CASH_OUT_TYPES: CashEntryType[] = ['loan_in_repay', 'loan_out', 'expense']

export const TAB_IDS = ['entry', 'stock', 'ledger', 'cash', 'daily', 'report'] as const
export type TabId = (typeof TAB_IDS)[number]

export const TAB_LABELS: Record<TabId, string> = {
  entry: 'Entry',
  stock: 'Stock',
  ledger: 'Ledger',
  cash: 'Cash',
  daily: 'Daily',
  report: 'Report',
}

export const LAST_TAB_STORAGE_KEY = 'spices_pos_last_tab'
