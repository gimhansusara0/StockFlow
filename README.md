# StockFlow

A clean, mobile-first stock manager for clothing — parent products, colour/print **variants** (each with its own photo & prices), **sizes** with per-size stock, **collections**, global search, stock-movement calculations, analytics and Excel export. Built as a **PWA** with React + Vite + Supabase, ready for Vercel.

## Features
- **Products** → photo, name, description, buying/selling price
- **Variants** (e.g. "Blue Dragon", "Yellow Print") → each with its **own image** + prices
- **Sizes** per variant (XS–XXL) with individual stock counts
- **Collections** → group multiple products together
- **Stock movements** → step-by-step "deduct stock" wizard, then reconcile returns / faults
- **Live calculations** → sold, returned, unusable, revenue, amount to pay provider, profit
- **Analytics** → totals, sell-through rate, top performers, **Excel export** (3 sheets)
- **Global search** across products, variants, collections
- **Fast caching** → instant loads from localStorage, only refetches when data changes
- **Realtime** → live updates across devices via Supabase Realtime
- **PWA** → installable, offline-capable shell

---

## 1. Set up Supabase
1. Create a project at https://supabase.com
2. Open **SQL Editor** → paste the contents of `supabase_schema.sql` → **Run**
3. Go to **Storage** → **New bucket** → name it `products` → tick **Public** → create
   *(the SQL already adds the read/write policies)*
4. (Realtime) Go to **Database → Replication** and make sure the tables are enabled for Realtime (they are by default for new projects).
5. Grab your **Project URL** and **anon public key** from **Project Settings → API**

## 2. Run locally
```bash
cp .env.example .env      # then paste your URL + anon key
npm install
npm run dev
```
Open the printed localhost URL on your phone (same network) to feel the mobile UI.

## 3. Deploy to Vercel
1. Push this folder to a GitHub repo
2. On Vercel → **New Project** → import the repo
3. Framework preset: **Vite** (auto-detected)
4. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. `vercel.json` already handles SPA routing.

Once live, open it on your phone → browser menu → **Add to Home Screen** to install the PWA.

---

## Notes
- The schema uses **open RLS policies** (single internal user). If you add Supabase Auth later, tighten the policies in `supabase_schema.sql`.
- "Pay provider" = buying price × units sold (what you owe your supplier for sold stock). Adjust the logic in `src/hooks/store.jsx → batchMath` if your arrangement differs.
- Returned units go **back into stock** automatically; unusable/faulty units do not.
