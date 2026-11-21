# Tasks — KiroPay

Build order for the KiroPay spec. Work top to bottom; mark a task done only
after its tests pass and `npm run type-check` is green. Requirements are
referenced as `Req N` (see `requirements.md`).

## Phase 1 — Project setup (Day 1)

- [x] 1. Scaffold Next.js 15 (App Router) + TypeScript strict + Tailwind CSS
      in this repo; verify `npm run dev` serves the starter page.
      _Req 9_
- [x] 2. Install wagmi 2, viem 2, @tanstack/react-query; configure the
      wagmi provider (injected + Coinbase Wallet connectors, Base Sepolia
      chain) in `src/app/layout.tsx`.
      _Req 3_
- [x] 3. Create `src/lib/chain.ts` with Base Sepolia config (chain ID 84532,
      RPC `https://sepolia.base.org`, USDC
      `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals, explorer URL);
      verify the USDC address on the explorer before continuing.
      _Req 4, Req 5_

## Phase 2 — Core library (Days 1–2)

- [x] 4. Create `src/lib/money.ts`: `parseUsdc` / `formatUsdc` using bigint
      base units (6 decimals); unit tests for edge cases (0, dust amounts,
      invalid input).
      _Req 8_
- [x] 5. Create `src/lib/invoice.ts`: `Invoice` type, `encodeInvoiceLink`
      / `decodeInvoiceLink` (base64url JSON), payload validation (address,
      positive amount, id match); unit tests including malformed payloads.
      _Req 1, Req 2, Req 8_
- [x] 6. Create `src/lib/store.ts`: localStorage CRUD for seller invoices
      (`kiropay:invoices`); unit tests with a storage mock.
      _Req 1, Req 7_
- [x] 7. Create `src/lib/verify.ts`: `findPaymentTransfer(receipt, invoice)`
      matching USDC Transfer logs (from/to/value); `scanForPayment` via
      `getLogs` for the dashboard re-check; unit tests with mocked receipts
      and logs.
      _Req 5, Req 7_

## Phase 3 — Seller: create invoice + dashboard (Days 3–4)

- [x] 8. Build `InvoiceForm` component (amount, description, due date,
      seller address prefilled from connected wallet) with validation
      messages; on submit, save invoice and show the payment link.
      _Req 1_
- [x] 9. Build the dashboard (`src/app/page.tsx`): invoice list newest
      first, status badges (unpaid / paid / expired), copy-link button with
      confirmation, empty state.
      _Req 2, Req 7_
- [x] 10. Add the "Check payment" action on unpaid invoices: rescan the
       chain via `scanForPayment` and update status + tx hash when found.
       _Req 7_

## Phase 4 — Buyer: payment page (Days 5–7)

- [x] 11. Build the buyer page `src/app/pay/[id]/page.tsx`: decode +
       validate the link payload, show invoice summary or a plain-language
       error for malformed links.
       _Req 2_
- [x] 12. Build `WalletButton`: connect (injected / Coinbase Wallet),
       shortened address display, Base Sepolia network guard with
       one-click switch, USDC balance display.
       _Req 3_
- [x] 13. Build `PayPanel`: pay button, balance check with faucet link on
       shortfall, single USDC `transfer` via wagmi, pending state with tx
       hash + explorer link, cancel/retry handling for rejected signatures.
       _Req 4, Req 8_
- [x] 14. Wire verification after receipt: match the Transfer event, then
       route to the receipt page; on mismatch show the failure reason and
       allow retry.
       _Req 5_

## Phase 5 — Receipt (Day 8)

- [x] 15. Build the receipt page `src/app/receipt/[txHash]/page.tsx`:
       invoice ID, amount, description, seller/buyer addresses, tx hash,
       block number, timestamp, explorer link; viewable without a wallet.
       _Req 6_

## Phase 6 — Polish, test, deploy (Days 9–11)

- [x] 16. Add the testnet notice banner (Base Sepolia, test USDC only) +
       Circle faucet link on every page; add a small "Frankenstein" visual
       motif (stitched divider) to tie the design to the category story.
       _Req 9_
- [ ] 17. Full manual end-to-end on Base Sepolia with Circle test USDC:
       create → copy link → second browser profile → connect → pay →
       receipt; plus negative paths (wrong network, insufficient balance,
       rejected signature, malformed link, expired invoice).
       _Req 1–9_
- [ ] 18. Deploy to Vercel from the public repo; verify the full flow on
       the public URL with a fresh wallet.
       _Req 9_
- [ ] 19. Record the demo video (< 3 min), write the Devpost description
       and the "How Kiro was used" write-up, and submit before the deadline
       (Fri 5 Dec 2026, 14:00 PT / 05:00 WIB).
       _Req 9_
