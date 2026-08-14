# Business Logic

All formulas below are implemented in `src/lib/calculations.ts`. If you
change a formula, change it there and update this doc in the same commit —
this file exists so you can sanity-check the app's math without reading
code.

## Average cost

A product's average cost is a running **weighted average**, recalculated
on every purchase:

```
newAvgCost = (oldStock * oldAvgCost + qtyBought * price) / (oldStock + qtyBought)
```

Sales never change average cost — only stock.

## Profit on a sale

```
profit = (sellPrice - avgCostAtTimeOfSale) * netQtySold
```

The profit is computed once and **stored on the transaction** (see
`transactions.profit` in [SCHEMA.md](./SCHEMA.md)) so it can be summed
later without recomputing every sale on every render.

## Recalculation strategy: replay, not reversal

The tricky part is: what happens to stock/avgCost/profit when you **edit or
delete an old transaction**? If transaction #3 (of 10) for a product is
edited, everything from #3 onward needs to change, because average cost is
a running value.

Two ways to handle this:

1. **Delta reversal** — algebraically "undo" the old transaction's effect,
   then "redo" it with new values. This is what the original feature
   request describes ("reverse the old transaction's effect... and reapply
   the new values"). It's fragile: it only produces correct results if the
   edited transaction was the *most recent* one affecting that product, and
   it gets easy to get wrong with edge cases (editing a transaction's type,
   editing an old transaction when later ones exist, floating-point drift
   accumulating over many edits).
2. **Full replay** — recompute the product's `stock`/`avgCost` from
   scratch by replaying *all* of its transactions in chronological
   (`timestamp`) order, starting from `openingStock`/`openingCost`, on
   every add/edit/delete.

The app uses **full replay** (`recomputeProduct()` in
`src/lib/calculations.ts`). It produces the exact same end state as a
correct delta-reversal implementation, but there is only one code path
that derives stock/avgCost/profit, so they can never drift out of sync
with the transaction list — no matter which transaction was edited, what
it was changed to, or whether it was the most recent one. For a personal
spice-trading ledger (hundreds, not millions, of transactions per product)
the O(n) replay cost is irrelevant.

`recomputeProduct(product, allTransactions)`:

1. Filters to this product's transactions, sorted by `timestamp` (ties
   broken by `id` for determinism).
2. Starts `stock = openingStock`, `avgCost = openingCost`.
3. Walks the sorted list:
   - **buy**: apply the weighted-average formula above, increase stock by
     `netQty`, set `profit = null`.
   - **sell**: compute `profit = (price - avgCost) * netQty` using the
     *current* running `avgCost`, decrease stock by `netQty` (avgCost
     unchanged).
4. Returns the updated product (`stock`, `avgCost`) and the full
   transaction array with this product's entries replaced by their
   recomputed copies (every other product's transactions pass through
   untouched).

This function runs inside the reducer (`src/context/AppDataContext.tsx`)
on every `ADD_TRANSACTION` / `UPDATE_TRANSACTION` / `DELETE_TRANSACTION`
action — that reducer is the *only* place stock/avgCost/profit are ever
computed.

## Stock and gross/net weight

For weight-type products, every transaction (buy **or** sell) can record a
`grossQty` (weighed-in amount) and a `netQty` (actual/payable amount after
deductions — moisture, bag weight, or anything else). The deduction
(`grossQty - netQty`) is never assumed to be a fixed percentage; it's
whatever the user enters. **Stock and average cost always move by
`netQty`, never `grossQty`.** `grossQty` is kept only for the deduction
readout and the per-product/per-day "total deducted" figures.

For count-type products, `grossQty` is always `null` and `netQty` holds the
quantity.

## Deleting a product

Deleting a product cascades: all of its transactions are deleted with it
(`DELETE_PRODUCT` in the reducer filters `transactions` by `productId` too).
Rationale: a transaction with no product to recompute against can't have a
meaningful stock/avgCost/profit, and letting it linger in the Ledger with a
dangling reference would be more confusing than useful for a personal,
single-user ledger. If you delete a product by mistake, there's no undo —
that's why product delete (like every delete in this app) requires
tap-to-confirm.

## Cash drawer formula

```
cashDrawer = (totalSales - totalPurchases)
           + capitalIn
           + loanIn
           - loanInRepay
           - expenses
           - loanOut
           + loanOutRepay
```

- `totalSales` / `totalPurchases` come from **transactions** (all `sell` /
  `buy` totals), not cash entries.
- Everything else comes from **cash entries** grouped by `type`.

`youOwe = max(0, loanIn - loanInRepay)` and
`owedToYou = max(0, loanOut - loanOutRepay)` — clamped at zero so an
over-repayment doesn't show as a negative "you owe" figure; it just shows
zero outstanding.

## Daily cashbook grouping

`computeDayGroups()` buckets every transaction and cash entry by **local
calendar day** (`dateKeyOf()` in `src/lib/format.ts`), most recent day
first, with each day's own entries sorted chronologically (oldest first)
to read like a physical daybook.

Per day, two different "cash" numbers are surfaced to avoid double
counting:

- `totalSales` / `totalPurchases` / `totalProfit` — from that day's
  **transactions**.
- `cashIn` / `cashOut` — from that day's **cash entries only** (capital,
  loans, expenses). This is what the "Cash In/Out" mini stat card shows.
- `netCashFlow` (shown on the day's collapsed header) —
  `totalSales - totalPurchases + cashIn - cashOut`, i.e. the day's full
  cash-drawer effect, trade and non-trade combined.

`totalWeightDeducted` sums `grossQty - netQty` across that day's
weight-type transactions (buys and sells both).

## Low stock and most valuable stock

- **Low stock**: any product with `stock <= threshold` (threshold is a
  plain number the user can type into the Report tab; there's no
  per-unit-type normalization — a "5" threshold is compared against `stock`
  directly whether the unit is kg, g, or bags, matching the spec as
  written).
- **Most valuable stock**: products ranked by `stock * avgCost`,
  descending.
- **Total stock value** (Report tab stat card): sum of `stock * avgCost`
  across all products.
- **Trading profit** (Report tab stat card): sum of the stored `profit`
  field across all sell transactions.
- **Net profit (after expenses)**: `tradingProfit - totalExpenses`.
