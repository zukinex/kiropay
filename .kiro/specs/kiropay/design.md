# Design — KiroPay

## Overview

KiroPay is a static Next.js frontend with no backend. The "Frankenstein"
combination is: Web2 invoicing UX + Web3 wallet payments + on-chain
verification, stitched into one flow that needs no server.

```
Seller browser                    Buyer browser
┌──────────────────┐              ┌──────────────────┐
│ Create invoice   │  payment     │ Open /pay/[id]   │
│ (form)           │  link (URL)  │ Connect wallet   │
│ Save to          ├─────────────►│ Pay USDC (transfer)
│ localStorage     │              │ Wait receipt     │
│ Dashboard        │              │ Verify Transfer  │
│ (list + status)  │              │ event on-chain   │
└──────────────────┘              │ Show receipt     │
                                  └──────────────────┘
                                         │
                              Base Sepolia (chain 84532)
                              USDC 0x036C…F7e (6 decimals)
                              Public RPC: sepolia.base.org
```

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict | Standard, deploys free on Vercel |
| Wallet | wagmi 2 (injected + Coinbase Wallet connectors) | No WalletConnect project ID needed |
| Chain client | viem 2 | Reads, receipts, event logs |
| Styling | Tailwind CSS | Fast, no design system to build |
| State | React state + localStorage (seller invoices) | Zero backend, zero DB |
| Tests | Vitest | Unit tests for lib modules |
| Deploy | Vercel | Static frontend, free tier |

## Data model

```ts
type InvoiceStatus = "unpaid" | "paid" | "expired";

interface Invoice {
  id: string;            // 12-char URL-safe random id
  seller: `0x${string}`; // seller wallet address
  amount: string;        // USDC in 6-decimal base units, as decimal string (bigint-safe)
  description: string;   // max 140 chars
  dueDate: string | null;// ISO date, optional
  createdAt: string;     // ISO timestamp
  status: InvoiceStatus;
  txHash: `0x${string}` | null;
}
```

Invoices are stored in `localStorage` under key `kiropay:invoices` (seller
side only). The payment link carries the invoice as base64url-encoded JSON in
the `data` query param, so the buyer page needs no server lookup:

```
/pay/<id>?data=<base64url(JSON of {id, seller, amount, description, dueDate, createdAt})>
```

The buyer page decodes and validates the payload (valid address, positive
amount, matching id) before rendering anything payable.

## Payment flow (buyer)

1. Open `/pay/[id]`, decode + validate invoice payload.
2. Connect wallet (injected / Coinbase Wallet). If network != Base Sepolia,
   show warning + "Switch network" button.
3. Show invoice summary + buyer USDC balance. Block pay if balance <
   amount, with faucet link.
4. Click Pay → wagmi `writeContract` USDC `transfer(seller, amount)` —
   a single transaction, no approve step.
5. `useWaitForTransactionReceipt` waits for success (≥ 1 confirmation).
6. Verify: `getTransactionReceipt(txHash)` → scan logs for a USDC
   `Transfer` event with `from == buyer`, `to == seller`,
   `value == amount`. Match required on all three fields.
7. On match: status `paid`, show receipt at `/receipt/[txHash]`.
   On mismatch/failure: show plain-language error, allow retry.

## Seller status check

The dashboard "Check payment" button re-scans the chain for the invoice:
`getLogs` on the USDC contract, `Transfer` events to the seller address,
from the invoice creation block onward, filtered by exact `value == amount`
and `from` any buyer. If found, the invoice becomes `paid` with that
transaction hash. (First match wins; amounts are per-invoice unique in
practice, and the dashboard also matches on the link's buyer if known.)

## Chain configuration

| Item | Value |
| --- | --- |
| Chain | Base Sepolia, chain ID `84532` |
| RPC | `https://sepolia.base.org` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals |
| Explorer | `https://sepolia.basescan.org` |
| Faucet | `https://faucet.circle.com` (test USDC + test ETH) |

All chain constants live in `src/lib/chain.ts`. Re-verify the USDC address
on-chain (explorer + Circle docs) before release.

## Security

- No private keys, mnemonics, or secrets anywhere. The app never asks for
  them; all signing happens in the user's own wallet.
- Money: `bigint` base units only. `parseUnits`/`formatUnits` with 6
  decimals at the UI boundary. No floats.
- URL payloads are untrusted input: validate address (`isAddress`),
  positive amount, and id match before rendering a payment.
- Payments are refused on any chain other than Base Sepolia (testnet-only
  guard in the pay flow).
- No backend means no API keys and no user data stored anywhere except the
  seller's own browser.

## Testing strategy

- Unit tests (Vitest) for `src/lib/`: money parse/format, invoice
  encode/decode + validation, verification log-matching (with mocked
  receipts), status derivation (expired vs unpaid).
- Manual end-to-end on Base Sepolia with Circle test USDC: create →
  copy link → open in a second browser profile → connect → pay → receipt;
  plus the negative paths (wrong network, insufficient balance, rejected
  signature, malformed link).
- `npm run type-check` and `npm run lint` must be green before every
  commit (enforced by `.kiro/hooks/kiropay-quality-check.json`).

## Deployment

Vercel, free tier, from the public GitHub repo. No environment variables
needed (all config is public chain constants). The deployed URL goes in the
Devpost submission.

## Out of scope (v1)

Accounts/login, fiat/cards, multi-token, partial payments, refunds,
notifications, mainnet. These are explicitly excluded to keep the 12-day
build achievable.
