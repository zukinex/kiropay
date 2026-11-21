---
inclusion: always
---

# Product — KiroPay

## What it is

KiroPay is an invoice + payment-link app for stablecoins. A seller creates an
invoice in USDC, shares a link, and gets paid on-chain. The buyer pays from
their own wallet. The app verifies the payment by reading the chain and issues
a receipt. No accounts, no custodial backend, no server database.

## Who it is for

- **Sellers**: freelancers, small online sellers, and creators who want to
  accept USDC without setting up a payment processor or holding customer funds.
- **Buyers**: anyone with a wallet and test/mainnet USDC who wants to pay an
  invoice in one click and get a verifiable receipt.

## Product principles

1. **No custody, ever.** Money moves wallet-to-wallet via a plain ERC-20
   `transfer`. KiroPay never holds funds and never asks for a private key.
2. **Verify, don't trust.** A payment is only "paid" when the chain says so:
   a confirmed `Transfer` event for the exact invoice amount to the seller.
3. **Zero backend.** Invoices live in the seller's browser; the payment link
   carries the invoice data in the URL. The app is a static frontend plus
   public RPC reads. If the server disappeared, the link still describes the
   invoice.
4. **Testnet first.** The demo runs on Base Sepolia with Circle test USDC.
   Real money is out of scope for this hackathon build.
5. **One job, done well.** Create invoice → share link → pay → verify →
   receipt. Nothing else in v1.

## Non-goals (v1)

- No user accounts, login, or seller profiles.
- No fiat, no cards, no on/off-ramps.
- No multi-token support (USDC only), no partial payments, no refunds.
- No email/SMS notifications.
- No mainnet deployment in this build.

## Success criteria

- A seller can create an invoice and copy a working payment link in under
  60 seconds.
- A buyer can open the link, connect a wallet, and pay in under 60 seconds.
- The receipt appears only after on-chain confirmation, with a block explorer
  link to the exact transaction.
- The whole flow works end-to-end on Base Sepolia with test USDC from the
  Circle faucet.
