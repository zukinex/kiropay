# Requirements — KiroPay

KiroPay is a stablecoin invoice + payment-link app. A seller creates a USDC
invoice, shares a payment link, a buyer pays from their wallet, the app
verifies the payment on-chain, and a receipt is generated. Demo chain: Base
Sepolia testnet (chain ID 84532), Circle test USDC. No backend, no accounts,
no custody.

Acceptance criteria use EARS notation: `WHEN <trigger> THE SYSTEM SHALL
<behavior>`.

## Requirement 1 — Create invoice

**User story:** As a seller, I want to create a USDC invoice with an amount,
a description, and an optional due date, so I can bill a customer without a
payment processor.

- WHEN the seller submits the invoice form with a valid amount (> 0), a
  description, and their wallet address, THE SYSTEM SHALL create an invoice
  with a unique ID, status `unpaid`, and a creation timestamp.
- WHEN the amount is zero, negative, or not a number, THE SYSTEM SHALL reject
  the form and show which field is invalid.
- WHEN the seller address is not a valid EVM address, THE SYSTEM SHALL reject
  the form and explain the address is invalid.
- WHEN the invoice is created, THE SYSTEM SHALL save it to the seller's
  browser storage and show the shareable payment link immediately.

## Requirement 2 — Payment link

**User story:** As a seller, I want a shareable payment link for each invoice,
so the buyer can open it and pay without installing anything or creating an
account.

- WHEN an invoice exists, THE SYSTEM SHALL provide a payment link of the form
  `/pay/<invoice-id>?data=<base64url-encoded invoice>` that opens the buyer
  payment page.
- WHEN the buyer opens the link, THE SYSTEM SHALL decode and validate the
  invoice payload and display amount, description, seller address, and due
  date (if any).
- WHEN the link payload is malformed, has an invalid address, or a
  non-positive amount, THE SYSTEM SHALL refuse to render a payment and show a
  plain-language error.
- WHEN the seller clicks "Copy link", THE SYSTEM SHALL copy the full payment
  URL to the clipboard and confirm it was copied.

## Requirement 3 — Wallet connect

**User story:** As a buyer, I want to connect my wallet on the payment page,
so I can pay the invoice from my own funds.

- WHEN the buyer clicks "Connect wallet", THE SYSTEM SHALL offer the injected
  wallet and Coinbase Wallet connectors (no extra signup or API key).
- WHEN the wallet is connected on a network other than Base Sepolia, THE
  SYSTEM SHALL show a network warning and offer a one-click switch to Base
  Sepolia.
- WHEN the wallet is connected on Base Sepolia, THE SYSTEM SHALL show the
  connected address (shortened) and the buyer's test USDC balance.

## Requirement 4 — Pay in USDC

**User story:** As a buyer, I want to pay the exact invoice amount in USDC
with one transaction, so the seller receives the money directly.

- WHEN the buyer clicks "Pay", THE SYSTEM SHALL send a single ERC-20
  `transfer` of the exact invoice amount (6-decimal base units) to the
  seller address — no allowance or second approval transaction.
- WHEN the buyer's USDC balance is lower than the invoice amount, THE SYSTEM
  SHALL block the payment and explain the shortfall, including the faucet
  link for test USDC.
- WHEN the buyer rejects the signature in their wallet, THE SYSTEM SHALL
  show that the payment was cancelled and let the buyer retry.
- WHEN the transaction is submitted, THE SYSTEM SHALL show a pending state
  with the transaction hash and a block explorer link.

## Requirement 5 — On-chain verification

**User story:** As a seller and buyer, I want the payment to be confirmed by
reading the chain, so "paid" means the money really moved.

- WHEN a payment transaction is submitted, THE SYSTEM SHALL wait for its
  receipt and confirm it succeeded (status `success`, at least 1
  confirmation).
- WHEN the receipt is confirmed, THE SYSTEM SHALL verify a USDC `Transfer`
  event exists in the receipt logs with `from` = buyer, `to` = seller, and
  `value` = exact invoice amount.
- WHEN the receipt or the Transfer event does not match the invoice, THE
  SYSTEM SHALL mark the payment as failed and explain why.
- WHEN verification succeeds, THE SYSTEM SHALL update the invoice status to
  `paid` and store the transaction hash.

## Requirement 6 — Receipt

**User story:** As a buyer, I want a receipt after paying, so I have proof of
payment I can share or check later.

- WHEN verification succeeds, THE SYSTEM SHALL show a receipt with invoice
  ID, amount, description, seller address, buyer address, transaction hash,
  block number, and timestamp.
- WHEN the buyer opens the receipt link, THE SYSTEM SHALL display the same
  receipt without requiring a wallet connection.
- WHEN the receipt is viewed, THE SYSTEM SHALL link the transaction hash to
  the Base Sepolia block explorer.

## Requirement 7 — Seller dashboard

**User story:** As a seller, I want a dashboard of my invoices with their
status, so I can see what is unpaid, paid, or expired at a glance.

- WHEN the seller opens the app, THE SYSTEM SHALL list all invoices created
  in this browser, newest first, with amount, description, status, and due
  date.
- WHEN an invoice's due date has passed and it is still unpaid, THE SYSTEM
  SHALL show its status as `expired`.
- WHEN the seller clicks "Check payment" on an unpaid invoice, THE SYSTEM
  SHALL re-scan the chain for a matching USDC Transfer and update the status
  if the payment is found.
- WHEN the seller has no invoices yet, THE SYSTEM SHALL show an empty state
  with a clear call to create the first invoice.

## Requirement 8 — Safety and error handling

**User story:** As a user, I want clear errors and no way to lose money by
mistake, so I can trust the app with a real payment flow.

- WHEN the app is used on any network other than Base Sepolia, THE SYSTEM
  SHALL refuse to send a payment and explain the demo is testnet-only.
- WHEN the RPC is unreachable, THE SYSTEM SHALL show a plain-language
  connection error and a retry button instead of a blank page.
- WHEN an amount is displayed, THE SYSTEM SHALL format USDC with 6 decimals
  correctly and never use floating-point arithmetic for money.
- THE SYSTEM SHALL never request, log, or store a private key or mnemonic.

## Requirement 9 — Demo-ready deployment

**User story:** As the hackathon entrant, I want the app deployed on a public
URL, so judges can open it and complete the full flow without setup.

- WHEN the app is deployed, THE SYSTEM SHALL serve the full flow (create →
  pay → verify → receipt) from the public URL with no login.
- WHEN a judge opens the app, THE SYSTEM SHALL show a visible testnet notice
  (Base Sepolia, test USDC only) and a link to the Circle faucet.
