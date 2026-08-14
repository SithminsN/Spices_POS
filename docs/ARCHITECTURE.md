# Architecture

## Stack

- **React 19 + TypeScript**, built with **Vite**.
- No router — it's a single page with an in-memory tab switch
  (`src/App.tsx`), because there's nothing to deep-link to for a
  single-user daily-use tool.
- No UI framework/component library, no CSS framework. Plain CSS files
  colocated with their component, sharing one token/utility layer
  (`src/styles/tokens.css`, `src/styles/global.css`). Keeps the dependency
  list tiny and every visual decision explicit and greppable.
- No custom backend — the frontend talks to **Firestore** (Firebase)
  directly. See "Firestore sync" below.

## Folder structure

```
src/
  types/            Domain types (Product, Transaction, CashEntry, ...) — the contract
  lib/
    constants.ts     Enums/labels/thresholds shared across the app
    format.ts         Presentation-only helpers (currency, dates, quantities)
    calculations.ts   All business math (avg cost, profit, cash drawer, daily grouping, ...)
  data/
    firebase.ts        Initializes the Firebase app/Firestore/Auth from env vars
    firestoreSync.ts    Auth gate + subscribe/write helpers — the only files that touch Firestore
    diff.ts             Structural diff so writes touch only changed documents
  context/
    AppDataContext.tsx  Pure reducer (business logic) + Firestore sync wiring
    ToastContext.tsx    Toast queue used by every save/edit/delete action
  components/
    layout/           TabBar (app shell chrome)
    common/           Reusable pieces used by 2+ tabs: ToastHost, ConfirmButton, StatCard,
                       ProductPicker, TransactionRow, CashEntryRow
  features/
    entry/  stock/  ledger/  cash/  daily/  report/
                       One folder per tab. Each exports a default `<XTab />`
                       component that takes no props — everything it needs
                       comes from useAppData()/useToast().
docs/                 This folder
```

## Data flow

`AppDataProvider` (in `src/context/AppDataContext.tsx`) is the single
source of truth. `{ products, transactions, cashEntries }` are three
plain `useState` arrays, kept in sync with Firestore by an `onSnapshot`
listener per collection (set up once, on mount, after an anonymous auth
session is established). Every tab reads via `useAppData()` and mutates
via the functions that context exposes (`addTransaction`,
`updateTransaction`, `deleteTransaction`, ...) — no tab ever computes
stock/avgCost/profit itself or talks to Firestore directly.

Anything that isn't one of the four stored fields above (`stock`,
`avgCost`, `total`, `profit`) is a **derived selector**: stock value, low
stock, most valuable stock, cash drawer balance, daily groups. These live
in `src/lib/calculations.ts` as pure functions and are called straight
from the tab components — nothing is cached or duplicated in state, so
there's nothing to keep in sync.

```
UI action (e.g. "Save" on Entry tab)
   → useAppData().addTransaction(input)
      → dispatch({ type: 'ADD_TRANSACTION', input }) inside AppDataContext
         → reducer(prev, action) builds the raw transaction, then calls recomputeProduct()
            → replays that product's transactions, returns updated product + transactions
         → next state (kept in a ref immediately, so a second rapid dispatch
           doesn't read stale data before the round trip below completes)
      → diffCollection(prev, next) per collection — figures out exactly which
        product/transaction/cash-entry documents actually changed
      → syncCollection() batches setDoc/deleteDoc calls for just those documents
      → Firestore's local cache applies the write immediately (even offline);
        the onSnapshot listener fires and setProducts/setTransactions/
        setCashEntries update the UI
   → useToast().showToast(...)
```

The reducer itself (`reducer()` in `AppDataContext.tsx`) is 100% unchanged
from the original localStorage-backed version — swapping the backend only
ever touched *how* state gets read/persisted, never the business logic
that computes it.

## Design system

Every color, font, spacing and radius value used anywhere in the app comes
from `src/styles/tokens.css` (CSS custom properties on `:root`). Component
CSS files should reference `var(--color-...)` etc., never a literal hex
value — that's what keeps six independently-built tabs looking like one
cohesive app instead of six different apps stapled together.

`src/styles/global.css` defines the shared visual vocabulary every
component reuses instead of reinventing: `.card`, `.btn` /
`.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-ghost`, `.chip`,
`.badge`, `.field` (form rows), `.amount-credit` / `.amount-debit` /
`.amount-profit` / `.amount-loss`, and `.num` (tabular figures — apply this
class to any element showing a number so lists of amounts stay
vertically aligned).

Fonts: **Fraunces** (serif, characterful — headings, big stat numbers) +
**Inter** (clean sans — body text, labels, inputs), loaded via Google
Fonts `<link>` tags in `index.html`.

Layout is mobile-first: `.page` caps content at `--mobile-max-width`
(480px) below 1024px viewport width. At `min-width: 1024px` the top tab
bar becomes a fixed left sidebar (`TabBar.css`) and `.page` widens to
`--desktop-max-width` (1180px), giving tabs room to use multi-column
grids for stat cards on desktop.

## Firestore sync

The database is a Firebase project on the free **Spark** plan — Firestore
only, no Firebase Auth (see "Security model" below for why). Three files
own this, and nothing else in the app touches Firestore:

- **`src/data/firebase.ts`** — initializes the Firebase app and Firestore
  (with a persistent local cache — see below) from the `VITE_FIREBASE_*`
  env vars in `.env`.
- **`src/data/firestoreSync.ts`** — `subscribeCollection()` (wraps
  `onSnapshot`) and `syncCollection()` (batches `setDoc`/`deleteDoc` for a
  given list of documents/ids).
- **`src/data/diff.ts`** — `diffCollection(prev, next)` compares two
  versions of an id-keyed array and returns exactly which items were
  added/changed and which ids were removed, by value (not object
  identity) — see why this matters below.

Firestore collections: `products`, `transactions`, `cash_entries` — one
document per record, using the same `id` (a `crypto.randomUUID()`) as both
the record's `id` field and its Firestore document id, shaped exactly like
[SCHEMA.md](./SCHEMA.md) describes. No Cloud Functions, no server code —
this really is "frontend calls the database directly," per the brief.

**Why diff before writing.** `recomputeProduct()` (see
[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)) always returns a fresh object
for every one of a product's transactions, even ones whose values didn't
actually change — replaying is simpler to reason about than tracking
exactly what changed. Writing *every* one of those objects to Firestore on
every mutation would burn through the free tier's daily write quota fast
as transaction history grows. `diffCollection()` compares field values
(not object references) between the previous and next state and returns
only the documents that are genuinely different, so `AppDataContext`'s
`dispatch()` only ever writes what actually changed.

**Why a persistent local cache.** `initializeFirestore(..., { localCache:
persistentLocalCache() })` in `firebase.ts` means reads and writes apply
to an on-device (IndexedDB) cache immediately — including while offline —
and Firestore syncs to the server in the background. Combined with
`onSnapshot` listeners, this is what gives the UI its instant feedback on
save/edit/delete without any hand-rolled optimistic-update code: the
local cache update alone is enough to fire the listener and re-render.

**Security model.** There is no auth layer at all — Firestore rules (set
in the Firebase console, not in this repo) are wide open:
`allow read, write: if true`. This was a deliberate choice for a
single-user personal tool used from multiple devices (phone + desktop)
with no login UI: anonymous auth was tried first as a lightweight gate,
but it added setup friction (a separate console step, a class of errors
if it wasn't enabled) for a database that only ever holds one person's
spice-trading ledger. The real tradeoff: **anyone who obtains this
project's config values (visible in the deployed app's JS bundle once
hosted) can read and write this data with no restriction whatsoever.**
Acceptable for personal, non-sensitive business data with a low-traffic
deployment; revisit immediately if this app is ever shared with anyone
else or holds anything more sensitive — add real sign-in (email/password
or Google) and scope rules/queries to `request.auth.uid`.

## Deployment (free tier)

Database is live (Firestore, Spark plan). Frontend deployment is still
pending — the app currently only needs to run locally (`npm run dev`).
When ready: `npm run build` produces static files in `dist/`. Any static
host's free tier works — Vercel, Netlify, Cloudflare Pages, or GitHub
Pages are all zero-cost for a single personal-use SPA. Remember to add
the same `VITE_FIREBASE_*` values as build-time environment variables on
whichever host you pick (they're not secret — see "Security model" above
— but they do need to be present at build time for `import.meta.env` to
pick them up).
