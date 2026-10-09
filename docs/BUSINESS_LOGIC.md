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
that's why product delete opens a confirmation modal where the product's
name must be typed before Confirm is enabled. Every other delete
(transactions, cash entries) opens a yes/no confirmation modal
(`ConfirmButton` → `ConfirmDialog`).

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

## Today's purchases (Entry tab product list)

`getPurchasesOnDay(transactions, dateKey)` sums each product's **buy**
transactions on one local calendar day (same `dateKeyOf()` bucketing as
the daily cashbook). The Entry tab calls it with today's key and shows the
result on the right of each product in the picker:

```
qty      = sum of netQty           (today's buys only)
spent    = sum of total            (netQty * price per buy)
avgPrice = spent / qty             (weighted by quantity)
```

`avgPrice` is weighted, not a plain average of prices: buying 100 kg at
Rs. 300 and 400 kg at Rs. 200 gives 500 kg, Rs. 110,000 spent, avg
Rs. 220 (not Rs. 250). Like stock, quantities are **net**, not gross.
Display-only — nothing here is stored.

## Stock tab date filter

The Stock tab's start/end dates select **whole local calendar days**: the
half-open range `[00:00 on start date, 00:00 on the day after end date)`.
Either side can be empty (open-ended). `startOfDateKey()` builds local
midnight from the date parts — never `new Date('yyyy-mm-dd')`, which is
UTC and would drop 00:00–05:30 Sri Lanka time. `isInRange()` is the one
boundary check everything uses.

`getProductPeriodSummary(product, transactions, range)` returns a stock
movement statement per product:

```
openingStock  = stock at the start of the range
+ boughtQty   (spent,   avgBuyPrice  = spent / boughtQty)
- soldQty     (revenue, avgSellPrice = revenue / soldQty)
= closingStock  (closingAvgCost, closingValue = closingStock * closingAvgCost)
profit        = sum of the stored profit on sells in the range
deducted      = sum of (grossQty - netQty) in the range
```

Opening/closing stock and closing avg cost come from replaying the
product's transactions with the **same rules and ordering as
`recomputeProduct()`**, stopped at the range boundaries — so the closing
avg cost is exactly what the running weighted average was at that moment.
It is read-only: nothing is stored. With no range (all time), closing
stock/avg cost equal the product's stored `stock`/`avgCost`.

- A product's history starts at `getHistoryStart()`: when it was added,
  or earlier if a transaction was back-dated before that. If the history
  starts inside the range, opening stock is its `openingStock`.
- Products whose history starts after the range ends are hidden (they
  didn't exist yet).
- With a filter, the row header shows stock, avg cost and value **as at
  the end of the range**; without one it shows the stored current values.
- Product delete still counts and deletes **all** of a product's
  transactions, whatever the filter.

## Editing a transaction's date

New entries never ask for a date — they're stamped with the save time.
Editing a transaction (Entry → Recent Transactions, Ledger, Daily, a
product's list on the Stock tab — all the same `TransactionRow`) shows
**Date** and **Time** fields pre-filled with its current `timestamp`.
Cash entries get the same fields.

- `timestampFromInputs()` builds the new local timestamp. Unchanged
  inputs return the original timestamp exactly; a changed date keeps the
  original seconds/ms, so the record keeps its order among others from
  the same minute. Future dates/times are rejected (Save is disabled).
- Saving goes through the normal `UPDATE_TRANSACTION` →
  `recomputeProduct()` path. Because replay is in `timestamp` order,
  moving a transaction changes stock/avgCost and the stored `profit` of
  any later sales of that product — exactly as if it had been entered on
  that date. Every tab reads the one `timestamp`, so Ledger order, Recent
  Transactions, Daily grouping, today's purchases and the Stock filter all
  follow automatically.
- The edit form's negative-stock warning replays the product's history
  with the edit applied (`getLowestStockPoint()`) and warns only if the
  edit makes stock dip lower than it already did, naming the date.

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
