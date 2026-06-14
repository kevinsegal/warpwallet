# WarpWallet

A security-first **web wallet and payments platform for WarpCoin (WARP)** —
built for cross-border *and* inter-planetary transacting.

WarpWallet is a Next.js 16 app, ready to deploy on Vercel, that brings the
[WarpCoin](https://github.com/kevinsegal/warpcoin) proof-of-work chain to the
browser with five integrated products:

| Product | What it does |
|---|---|
| 👛 **Wallet** | Create/import a self-custody wallet, send/receive WARP, view activity. Keys are generated and signed with **in your browser** and never transmitted. |
| 🏷️ **warp#tags** | Human-friendly handles (`warp#nova`) that resolve to addresses, bound to your key by signature. |
| 🤝 **Escrow** | Lock funds until a deal completes; buyer/seller/arbiter releases, each authorized by a wallet signature. |
| 🛍️ **Merchant gateway** | Register a business, mint an API key, create invoices, hosted checkout, and HMAC-signed payment webhooks. |
| 🧩 **WarpScript studio** | A no-code GUI to compose smart contracts (escrow, vesting, multisig, interplanetary transfers…) and deploy content-addressed artifacts. |
| 🪐 **Interplanetary** | A light-time calculator and light-time-aware contracts — settlement that respects the speed of light. |

## Why it's secure

WarpWallet reproduces WarpCoin's **on-chain cryptography exactly**, so a
transaction signed in the browser is valid on the live chain (verified against
the Go reference implementation: `wallet.ValidateAddress` and
`core.Transaction.Verify` accept WarpWallet-signed transactions byte-for-byte).

- **Client-side keys** — ECDSA **P-256**, compressed pubkeys, Base58Check
  addresses (version `0x49`, "W…"), double-SHA256 — all in
  [`src/lib/warp`](src/lib/warp).
- **Encrypted at rest** — private keys are sealed with **AES-256-GCM** behind a
  **PBKDF2** (SHA-256, 310k iterations) passphrase, stored only as ciphertext in
  `localStorage`.
- **Server never trusts the client** — every transaction and privileged action
  (tag claim, escrow release/refund) is re-verified server-side: signature,
  public-key↔address binding, nonce and balance.
- **Hardened transport** — strict security headers (HSTS, `nosniff`,
  frame-deny, locked-down permissions policy) on every response.

## Run locally

```sh
npm install
npm run dev      # http://localhost:3000
```

The app runs in **self-contained demo mode** out of the box: a built-in ledger
gives every new wallet a 1,000 WARP faucet so you can immediately send, escrow,
and pay. No database or node required.

```sh
npm run build && npm run start   # production build
npm run typecheck                # tsc --noEmit
```

## Deploy to Vercel

Push this repo and import it in Vercel — it's a standard Next.js app, zero
config. For a production deployment, set the environment variables in
[`.env.example`](.env.example):

- `WARP_RPC_URL` — point at a real WarpCoin full node's JSON-RPC. Balances,
  nonces, and transaction broadcast are then proxied to the live chain instead
  of the demo ledger.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Vercel KV (Upstash Redis) for
  durable shared state (tags, escrows, merchants, invoices, contracts). Without
  them, shared state is in-memory and per-instance.
- `NEXT_PUBLIC_BASE_URL` — used to build merchant checkout links.
- `WARP_WEBHOOK_SECRET` — HMAC key for signing merchant webhooks.

## Architecture

```
src/
  lib/warp/          isomorphic chain crypto (crypto, tx, format, keystore,
                     interplanetary, tag) — byte-compatible with kevinsegal/warpcoin
  lib/warpscript/    no-code contract model + deterministic compiler
  lib/server/        node RPC proxy + demo ledger, KV store, and the
                     tags / escrow / merchant / contracts domain services
  lib/client/        React wallet context (key mgmt, signing, API calls)
  app/api/           JSON route handlers (account, tx, tags, escrow, merchant,
                     invoice, contracts)
  app/               pages: /, /wallet, /escrow, /merchant, /pay/[invoice],
                     /contracts, /interplanetary
  components/        NavBar, Footer, QrCode, Copyable
```

### Live-node mode

When `WARP_RPC_URL` is set, `src/lib/server/node.ts` proxies to the WarpCoin
node RPC (`/balance`, `/account`, `/tx`, `/status`). Transactions are submitted
exactly as the chain expects — the same JSON shape as `core.Transaction`.

### Demo-vs-production note

The demo ledger and in-memory store are for evaluation and local development.
For real value transfer, configure `WARP_RPC_URL` (a real chain) and KV (durable
state). Escrow/merchant fund movements that the demo applies to its ledger are,
in live mode, realized as real signed transactions by the parties.

## Compatibility check

`scripts/compat_emit.mts` signs an address + transaction using the exact wallet
code, for cross-verification against the Go chain's `wallet`/`core` packages.

---

Demo software. Never share your private key or recovery passphrase.
