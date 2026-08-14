# Data Schema

The app persists to three Firestore collections (see
[ARCHITECTURE.md](./ARCHITECTURE.md) "Firestore sync" for how). They're
written here as "tables" because each is a flat, document-per-record
collection that reads just like one. The authoritative type definitions
live in `src/types/index.ts`; this file is the human-readable explanation
of them.

## `products`

One row per spice/product you trade.

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `name` | string | e.g. "Ceylon Cinnamon". |
| `measurementType` | `'weight' \| 'count'` | Determines which fields are used on transactions and which unit picker shows. |
| `unit` | string | `'kg'` or `'g'` for weight products; a free-text label ("bags", "packets", "sticks") for count products. |
| `stock` | number | **Derived, but stored.** Current net/actual stock. Recomputed by `recomputeProduct()` whenever a transaction for this product is added/edited/deleted. Never edit this field directly. |
| `avgCost` | number | **Derived, but stored.** Running weighted-average cost per unit. Same recomputation rule as `stock`. |
| `openingStock` | number | Stock at the moment the product was created. The starting point `recomputeProduct()` replays from. |
| `openingCost` | number | Cost per unit at the moment the product was created. |
| `createdAt` | number (epoch ms) | |
| `updatedAt` | number (epoch ms) | Bumped every time `recomputeProduct()` runs for this product. |

Products are never edited after creation (no product-edit feature exists,
by design — only add and delete). Deleting a product cascades: all of its
transactions are deleted too. See
[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md#deleting-a-product).

## `transactions`

One row per purchase (`buy`) or sale (`sell`). This is the Ledger.

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `type` | `'buy' \| 'sell'` | Purchase (debit) or sale (credit). |
| `productId` | string | Foreign key → `products.id`. |
| `productName` | string | **Snapshot** of the product's name at creation time, so history still reads sensibly after a product is renamed or deleted. |
| `measurementType` | `'weight' \| 'count'` | Snapshot, same reasoning. |
| `unit` | string | Snapshot. |
| `grossQty` | number \| null | Weight-type only. The weighed-in amount before deductions (moisture, bag weight, etc). `null` for count-type products. |
| `netQty` | number | Weight-type: the actual/payable weight after deductions. Count-type: the quantity. **This is the number stock and average cost math uses.** |
| `price` | number | Price per net unit. |
| `total` | number | `netQty * price`. Derived, stored for convenient display/history. |
| `profit` | number \| null | Sells only: `(price - avgCostAtSaleTime) * netQty`. `null` for buys. |
| `note` | string | Free text — customer/supplier name, etc. |
| `timestamp` | number (epoch ms) | When the transaction happened (defaults to save time, but edits can change it). |

## `cash_entries`

One row per cash-drawer movement that isn't a trade transaction — capital,
loans, and expenses. This is the Cash tab's ledger.

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `type` | `'capital_in' \| 'loan_in' \| 'loan_in_repay' \| 'loan_out' \| 'loan_out_repay' \| 'expense'` | See [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md#cash-drawer-formula) for how each affects the cash drawer balance. |
| `amount` | number | Always positive; the `type` determines direction. |
| `note` | string | Free text. |
| `timestamp` | number (epoch ms) | |

## Relationships

```
products (1) ──< (many) transactions
cash_entries            (independent — no product/transaction FK)
```

Everything else in the app (stock value, low-stock list, cash drawer
balance, daily cashbook, profit figures) is a **derived selector** computed
on the fly from these three arrays — see `src/lib/calculations.ts`. Nothing
except `products.stock` / `products.avgCost` / `transactions.total` /
`transactions.profit` is ever denormalized into storage.
