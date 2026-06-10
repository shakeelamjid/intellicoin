# IntelliCoin

Paste a TradingView indicator or strategy → IntelliCoin reads it, builds a scanner, and runs it
across the market. Free tier is metered per device; more requires a USDT pass, verified on-chain.

## Features in this build

- **Scanner** — paste Pine, understood/built scores, plain-English read-back, exchange + timeframe
  + optional filters, results. (Engine is stubbed; results are placeholder data for now.)
- **Free metering** — server-side, keyed on `hash(ip + device fingerprint)`, resets daily. Limits
  (free scans/day, free scripts) are set in the admin panel. Best-effort: deters casual abuse;
  payment is the real wall.
- **Passes** — day pass or monthly, paid in **USDT, any enabled chain**, with QR + a **unique
  amount per invoice** so a pasted tx maps to one order. On-chain **verify** grants the pass and
  marks the tx used (no reuse).
- **Admin panel** (`/admin`) — one bootstrapped admin (env). Edit prices + free limits, set
  receiving addresses + explorer keys per chain, enable/disable chains, see passes/payments.

## Payments

`PAYMENTS_MODE=mock` (default) accepts any tx hash so you can test the whole flow end-to-end
(use tx `fail` to simulate rejection). Set `PAYMENTS_MODE=live` and add explorer API keys in
admin to verify for real. The verifier checks: confirmed, USDT transfer to **your** address,
amount ≥ the unique invoice amount, and tx-not-already-used. TRC-20 (Tron) live adapter is
wired; EVM chains (ERC-20/BEP-20/Polygon) have a clear adapter stub to fill in.

> Accepting USDT from your jurisdiction may have regulatory implications — confirm with local
> counsel. The payment rail is isolated behind the verifier so it stays swappable.

## Deploy on Coolify

1. **Postgres**: project → New Resource → Database → Postgres. Copy its connection URL.
2. **App**: New Resource → Application → your Git repo → branch `main`. Build pack **Nixpacks**
   (auto-detects Next.js). **Port 3000**.
3. **Environment variables** (from `.env.example`):
   - `DATABASE_URL` — the Postgres URL from step 1
   - `SESSION_SECRET` — long random string
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — your admin login
   - `PAYMENTS_MODE=mock` to start (switch to `live` later)
4. **Deploy.** Tables auto-create + seed on first request (no migration step). Open `/admin`,
   log in, set prices + chain addresses.

## Local

```bash
cp .env.example .env.local   # fill DATABASE_URL etc.
npm install
npm run dev
```

## Structure

```
src/
  app/
    page.tsx                 scanner (ScannerApp)
    buy/page.tsx             pass purchase: plan → chain → QR + amount → verify
    admin/login, admin/      admin panel (protected by middleware + API auth)
    coin/[symbol]/           per-coin read
    api/                     scan, identity, pricing, chains, invoice, invoice/verify, admin/*
  components/                ScannerApp, ScriptInput, ScanConfig, RunPanel, ResultsTable, ...
  db/                        sql.ts (postgres.js), init.ts (schema + seed)
  lib/                       session (HMAC cookies), identity (metering), invoice, pass, admin, cookies
  payments/verify.ts         mock + per-chain on-chain verifier
  engine/ data/ lib/         scanner engine + data stubs (architecture documented)
```

## Next

- Implement the engine (parser → interpreter → scanner) to replace placeholder results.
- Fill EVM verifier adapters; flip `PAYMENTS_MODE=live`.
- Optional Redis resource for the computed-value cache.

## License & attribution

IntelliCoin is licensed under the **GNU AGPL-3.0** (see `LICENSE`).

It uses **[PineTS](https://github.com/LuxAlgo/PineTS)** (© LuxAlgo / Alaa-eddine
KADDOURI), an open-source Pine Script engine licensed under AGPL-3.0, to parse
and execute pasted indicators. PineTS is included as an npm dependency; its
license and copyright notices are preserved in `node_modules/pinets`.

Because this app is provided as a network service, its complete source code is
available to users under AGPL-3.0 at the repository linked in the app footer.
