# Spice Trading POS

A mobile-first business management tool for a spice trading business:
inventory, cash drawer/loans, and profit tracking in LKR. Single-user,
backed by a free-tier Firebase (Firestore) project — see
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) "Firestore sync" for how
it's wired up.

## Run locally

1. Copy `.env.example` to `.env` and fill in your Firebase project's Web
   App config values (see docs/ARCHITECTURE.md for where to get them).
2. ```bash
   npm install
   npm run dev -- --host
   ```

Open the printed **Network** URL on your phone (same Wi-Fi as your
computer) — the `--host` flag is what makes Vite's dev server reachable
from another device instead of only `localhost`.

```bash
npm run build     # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Docs

- [docs/SCHEMA.md](./docs/SCHEMA.md) — data shapes (products, transactions, cash entries)
- [docs/BUSINESS_LOGIC.md](./docs/BUSINESS_LOGIC.md) — average cost, profit, cash drawer, and daily-grouping formulas
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — folder structure, data flow, design system, and the database/deployment plan

