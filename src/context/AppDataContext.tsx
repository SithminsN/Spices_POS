import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { recomputeProduct } from '../lib/calculations'
import { diffCollection } from '../data/diff'
import { firebaseInitError, subscribeCollection, syncCollection, whenWritesSynced } from '../data/firestoreSync'
import type {
  CashEntry,
  CashEntryInput,
  NewProductInput,
  Product,
  Transaction,
  TransactionInput,
} from '../types'

interface AppDataState {
  products: Product[]
  transactions: Transaction[]
  cashEntries: CashEntry[]
}

type Action =
  | { type: 'ADD_PRODUCT'; input: NewProductInput }
  | { type: 'DELETE_PRODUCT'; id: string }
  | { type: 'ADD_TRANSACTION'; input: TransactionInput }
  | { type: 'UPDATE_TRANSACTION'; id: string; input: TransactionInput }
  | { type: 'DELETE_TRANSACTION'; id: string }
  | { type: 'ADD_CASH_ENTRY'; input: CashEntryInput }
  | { type: 'UPDATE_CASH_ENTRY'; id: string; input: CashEntryInput }
  | { type: 'DELETE_CASH_ENTRY'; id: string }

function replaceProduct(products: Product[], updated: Product): Product[] {
  return products.map((p) => (p.id === updated.id ? updated : p))
}

/**
 * Pure -- computes the next state for an action. This is unchanged from the
 * original localStorage-backed version; swapping the backend only changed
 * how this is invoked and persisted (see the provider below), never this
 * business logic itself.
 */
function reducer(state: AppDataState, action: Action): AppDataState {
  switch (action.type) {
    case 'ADD_PRODUCT': {
      const now = Date.now()
      const { input } = action
      const product: Product = {
        id: crypto.randomUUID(),
        name: input.name,
        measurementType: input.measurementType,
        unit: input.unit,
        stock: input.openingStock,
        avgCost: input.openingCost,
        openingStock: input.openingStock,
        openingCost: input.openingCost,
        createdAt: now,
        updatedAt: now,
      }
      return { ...state, products: [...state.products, product] }
    }

    case 'DELETE_PRODUCT': {
      // Deleting a product cascades to its transaction history -- see
      // docs/BUSINESS_LOGIC.md "Deleting a product".
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.id),
        transactions: state.transactions.filter((t) => t.productId !== action.id),
      }
    }

    case 'ADD_TRANSACTION': {
      const { input } = action
      const product = state.products.find((p) => p.id === input.productId)
      if (!product) return state
      const newTransaction: Transaction = {
        id: crypto.randomUUID(),
        type: input.type,
        productId: product.id,
        productName: product.name,
        measurementType: product.measurementType,
        unit: product.unit,
        grossQty: input.grossQty,
        netQty: input.netQty,
        price: input.price,
        total: 0,
        profit: null,
        note: input.note,
        timestamp: input.timestamp ?? Date.now(),
      }
      const { product: updatedProduct, transactions } = recomputeProduct(product, [
        ...state.transactions,
        newTransaction,
      ])
      return { ...state, transactions, products: replaceProduct(state.products, updatedProduct) }
    }

    case 'UPDATE_TRANSACTION': {
      const existing = state.transactions.find((t) => t.id === action.id)
      const product = existing && state.products.find((p) => p.id === existing.productId)
      if (!existing || !product) return state
      const { input } = action
      const updatedTransaction: Transaction = {
        ...existing,
        type: input.type,
        grossQty: input.grossQty,
        netQty: input.netQty,
        price: input.price,
        note: input.note,
        timestamp: input.timestamp ?? existing.timestamp,
      }
      const withUpdated = state.transactions.map((t) => (t.id === action.id ? updatedTransaction : t))
      const { product: updatedProduct, transactions } = recomputeProduct(product, withUpdated)
      return { ...state, transactions, products: replaceProduct(state.products, updatedProduct) }
    }

    case 'DELETE_TRANSACTION': {
      const existing = state.transactions.find((t) => t.id === action.id)
      if (!existing) return state
      const remaining = state.transactions.filter((t) => t.id !== action.id)
      const product = state.products.find((p) => p.id === existing.productId)
      if (!product) return { ...state, transactions: remaining }
      const { product: updatedProduct, transactions } = recomputeProduct(product, remaining)
      return { ...state, transactions, products: replaceProduct(state.products, updatedProduct) }
    }

    case 'ADD_CASH_ENTRY': {
      const { input } = action
      const entry: CashEntry = {
        id: crypto.randomUUID(),
        type: input.type,
        amount: input.amount,
        note: input.note,
        timestamp: input.timestamp ?? Date.now(),
      }
      return { ...state, cashEntries: [...state.cashEntries, entry] }
    }

    case 'UPDATE_CASH_ENTRY': {
      const { input } = action
      return {
        ...state,
        cashEntries: state.cashEntries.map((c) =>
          c.id === action.id
            ? {
                ...c,
                type: input.type,
                amount: input.amount,
                note: input.note,
                timestamp: input.timestamp ?? c.timestamp,
              }
            : c,
        ),
      }
    }

    case 'DELETE_CASH_ENTRY': {
      return { ...state, cashEntries: state.cashEntries.filter((c) => c.id !== action.id) }
    }

    default:
      return state
  }
}

const EMPTY_STATE: AppDataState = { products: [], transactions: [], cashEntries: [] }

/** What the user was doing, for the "couldn't save" message. */
const ACTION_LABELS: Record<Action['type'], string> = {
  ADD_PRODUCT: 'Adding a product',
  DELETE_PRODUCT: 'Deleting a product',
  ADD_TRANSACTION: 'Saving a sale or purchase',
  UPDATE_TRANSACTION: 'Editing a transaction',
  DELETE_TRANSACTION: 'Deleting a transaction',
  ADD_CASH_ENTRY: 'Adding a cash entry',
  UPDATE_CASH_ENTRY: 'Editing a cash entry',
  DELETE_CASH_ENTRY: 'Deleting a cash entry',
}

/** A write the server refused. Firestore undoes it locally, so it must be re-entered. */
export interface SaveError {
  id: string
  action: string
  detail: string
}

export interface AppDataContextValue extends AppDataState {
  /** True until the initial Firestore snapshot has loaded (see App.tsx). */
  isSyncing: boolean
  /** Set if Firebase failed to initialize (bad/missing .env values) -- see App.tsx. */
  syncError: string | null
  /** When the browser went offline (epoch ms), or null while online. */
  offlineSince: number | null
  /** Since when some changes exist only on this device (not yet on the server), or null. */
  unsyncedSince: number | null
  /** Writes the server refused since the user last dismissed them. */
  saveErrors: SaveError[]
  dismissSaveErrors(): void
  addProduct(input: NewProductInput): void
  deleteProduct(id: string): void
  addTransaction(input: TransactionInput): void
  updateTransaction(id: string, input: TransactionInput): void
  deleteTransaction(id: string): void
  addCashEntry(input: CashEntryInput): void
  updateCashEntry(id: string, input: CashEntryInput): void
  deleteCashEntry(id: string): void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([])
  const [isSyncing, setIsSyncing] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [offlineSince, setOfflineSince] = useState<number | null>(() => (navigator.onLine ? null : Date.now()))
  const [unsyncedSince, setUnsyncedSince] = useState<number | null>(null)
  const [saveErrors, setSaveErrors] = useState<SaveError[]>([])
  const pendingCheck = useRef(0)

  useEffect(() => {
    const handleOnline = () => setOfflineSince(null)
    const handleOffline = () => setOfflineSince((since) => since ?? Date.now())
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  /**
   * Marks "some changes are only on this device" until Firestore confirms
   * every write queued so far has reached the server. Only the most recent
   * check may clear the flag, since a newer write may still be in flight.
   */
  function trackPendingWrites() {
    const check = ++pendingCheck.current
    setUnsyncedSince((since) => since ?? Date.now())
    whenWritesSynced().then(
      () => {
        if (check === pendingCheck.current) setUnsyncedSince(null)
      },
      () => {},
    )
  }

  // Mirrors the three state arrays above so a mutation fired immediately
  // after a previous one (before its Firestore round trip lands) still
  // computes off the freshest local data, not a stale render's closure.
  const stateRef = useRef<AppDataState>(EMPTY_STATE)
  useEffect(() => {
    stateRef.current = { products, transactions, cashEntries }
  }, [products, transactions, cashEntries])

  useEffect(() => {
    if (firebaseInitError) {
      setSyncError(firebaseInitError)
      setIsSyncing(false)
      return
    }

    const unsubProducts = subscribeCollection<Product>('products', setProducts)
    const unsubTransactions = subscribeCollection<Transaction>('transactions', setTransactions)
    const unsubCashEntries = subscribeCollection<CashEntry>('cash_entries', setCashEntries)
    setIsSyncing(false)
    // Picks up writes still queued from an earlier session (e.g. the app was
    // closed while offline); resolves at once if there are none.
    trackPendingWrites()

    return () => {
      unsubProducts()
      unsubTransactions()
      unsubCashEntries()
    }
  }, [])

  function dispatch(action: Action) {
    const prev = stateRef.current
    const next = reducer(prev, action)
    stateRef.current = next

    const productsDiff = diffCollection(prev.products, next.products)
    const transactionsDiff = diffCollection(prev.transactions, next.transactions)
    const cashEntriesDiff = diffCollection(prev.cashEntries, next.cashEntries)

    const hasWrites = [productsDiff, transactionsDiff, cashEntriesDiff].some(
      (d) => d.toWrite.length > 0 || d.toDeleteIds.length > 0,
    )
    if (!hasWrites) return

    // Local UI updates once these writes land in Firestore's local cache and
    // the onSnapshot listeners above fire -- near-instant, including offline,
    // thanks to the persistent local cache configured in data/firebase.ts.
    void Promise.all([
      syncCollection('products', productsDiff.toWrite, productsDiff.toDeleteIds),
      syncCollection('transactions', transactionsDiff.toWrite, transactionsDiff.toDeleteIds),
      syncCollection('cash_entries', cashEntriesDiff.toWrite, cashEntriesDiff.toDeleteIds),
    ]).catch((error: unknown) => {
      // Only a server refusal lands here (offline writes just wait). Firestore
      // has already undone the change locally, so tell the user to redo it.
      console.error('Failed to sync to Firestore', error)
      const code = (error as { code?: unknown } | null)?.code
      const message = error instanceof Error ? error.message : String(error)
      setSaveErrors((errors) => [
        ...errors,
        {
          id: crypto.randomUUID(),
          action: ACTION_LABELS[action.type],
          detail: typeof code === 'string' ? `${code}: ${message}` : message,
        },
      ])
    })
    // Must run after the commits above are issued, so it waits for them too.
    trackPendingWrites()
  }

  const value = useMemo<AppDataContextValue>(
    () => ({
      products,
      transactions,
      cashEntries,
      isSyncing,
      syncError,
      offlineSince,
      unsyncedSince,
      saveErrors,
      dismissSaveErrors: () => setSaveErrors([]),
      addProduct: (input) => dispatch({ type: 'ADD_PRODUCT', input }),
      deleteProduct: (id) => dispatch({ type: 'DELETE_PRODUCT', id }),
      addTransaction: (input) => dispatch({ type: 'ADD_TRANSACTION', input }),
      updateTransaction: (id, input) => dispatch({ type: 'UPDATE_TRANSACTION', id, input }),
      deleteTransaction: (id) => dispatch({ type: 'DELETE_TRANSACTION', id }),
      addCashEntry: (input) => dispatch({ type: 'ADD_CASH_ENTRY', input }),
      updateCashEntry: (id, input) => dispatch({ type: 'UPDATE_CASH_ENTRY', id, input }),
      deleteCashEntry: (id) => dispatch({ type: 'DELETE_CASH_ENTRY', id }),
    }),
    [products, transactions, cashEntries, isSyncing, syncError, offlineSince, unsyncedSince, saveErrors],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
