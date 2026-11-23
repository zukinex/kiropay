# KiroPay — Devpost submission draft (task 19)

Prepared 2026-11-21 ~20:00 WIB. NOT submitted — user submits on Devpost himself.
Deadline (verified against official rules 2026-11-21): **Fri 4 Dec 2026 14:00 PT
= Sat 5 Dec 2026 05:00 WIB** (https://kiroween.devpost.com/rules — "No extensions
will be granted"). The README checklist line saying "05:00 WIB, 6 Dec" is WRONG
by one day — corrected locally in README.md, needs a push to GitHub to go live.

Facts used (all from the repo / verified records, no E2E claims yet):
- Live app: https://kiropay-iota.vercel.app/ (kiropay.vercel.app is a different,
  unrelated app — never use it)
- Repo: https://github.com/zukinex/kiropay (public, MIT, `.kiro/` at root)
- Chain: Base Sepolia (84532), USDC test `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Category: Frankenstein — target Best Frankenstein $5,000 (1 winner) + Best Demo $1,000
- Build: spec-first with Kiro CLI 3.5.0; tasks 1–16 done, 136/136 tests pass
- E2E (task 17) still BLOCKED on Base Sepolia ETH for gas — do NOT claim it passed
  until the user reports the paid test invoice + tx hash

## Devpost description (paste into "Description")

**KiroPay — get paid in stablecoins with a link. No backend, no trust-me step.**

A seller creates an invoice in USDC, shares a payment link, and the buyer pays
straight from their wallet. KiroPay then reads the chain itself to confirm the
payment and issues a receipt — no server, no database, no custodian in between.

How it works:
1. **Create** — the seller connects a wallet and creates an invoice (amount,
   description, due date). The invoice is saved in the seller's browser and a
   payment link is generated; the link itself carries the invoice data, so it
   works with zero server state.
2. **Pay** — the buyer opens the link, connects a wallet, and pays USDC with one
   transfer. A network guard switches them to Base Sepolia first, and a balance
   check points to the faucet when funds are short.
3. **Verify** — KiroPay matches the USDC Transfer event on-chain and routes to a
   receipt showing invoice ID, amount, description, seller and buyer addresses,
   tx hash, block number, timestamp, and an explorer link. Anyone can re-check
   the payment on the explorer — the receipt URL plus tx hash is proof forever.

Why Frankenstein: it stitches three things that normally never meet — Web2
invoicing (create a bill, share a link, track status), Web3 wallet payments
(wagmi + viem, non-custodial), and on-chain verification (the app trusts the
chain, not itself). The stitched-divider motif on every page is the tell.

Testnet only — Base Sepolia test USDC, no real money. Built solo: the builder
can't code, so every line was written through Kiro (see "How Kiro was used").

Try it: https://kiropay-iota.vercel.app/

## How Kiro was used (paste into "How Kiro was used" / write-up)

KiroPay was built spec-first with Kiro CLI 3.5.0, logged in via AWS Builder ID:

- **Spec** (`.kiro/specs/kiropay/`): `requirements.md` (9 requirements),
  `design.md`, and `tasks.md` (19 tasks in 6 phases) were written before any
  code. Each task names its requirements, and a task is only marked done after
  its tests pass and `npm run type-check` is green.
- **Steering** (`.kiro/steering/`): `product.md`, `tech.md`, `structure.md`
  kept every task on the same stack (Next.js 15 + wagmi/viem, no backend).
- **Hooks** (`.kiro/hooks/kiropay-quality-check.json`): lint on save and a
  type-check after each spec task.
- **Result:** tasks 1–16 complete — invoice creation, dashboard, buyer payment
  page, on-chain verification, receipt page with block/timestamp enrichment
  (verified against a real Base Sepolia transaction), testnet banner, and the
  Frankenstein stitched-divider motif. 136/136 tests pass.
- **Honest limit:** Kiro hit its monthly usage limit during task 7 — the free
  50 credits ran out. The 4,000 free hackathon credits were requested via the
  Devpost Resources tab on 2026-11-21 (Kiro User ID
  d-9067642ac7.64f8c438-3031-7010-afa0-d547aeb9f2f9) but the request was not
  approved (rejected 2026-11-23; resubmission pending); the remaining build was
  finished by batching tasks to conserve the ~37.5 free credits left, then
  completed directly.

## Demo video shot list (< 3 min, public on YouTube)

Record ONLY after task 17 (E2E) passes — the video needs a real paid invoice.
Follow `~/workspace/kiropay-e2e-test-script.md` (1 USDC test invoice,
"Test invoice KiroPay"). Shots, in order:

1. (0:00–0:20) Live app intro — testnet banner, "Create an invoice" form.
2. (0:20–0:50) Seller creates the 1 USDC invoice, copies the payment link.
3. (0:50–1:40) Second Chrome profile: open link, connect wallet, Pay in MetaMask.
4. (1:40–2:20) Receipt page — tx hash, block, timestamp; click through to
   sepolia.basescan.org showing the USDC transfer.
5. (2:20–2:50) Back on seller dashboard: invoice status flips to paid
   (or "Check payment"). Close: "KiroPay — invoice, link, pay, verified."

## Still to do before submit

- [ ] Task 17 E2E passes (waiting on Base Sepolia ETH — user reports when it arrives)
- [ ] Record demo video, upload public to YouTube, paste link above
- [ ] Push the README deadline fix (local edit done 2026-11-21; use push_kiropay.py)
- [ ] Claim the 4,000 Kiro credits before Tue 1 Dec 2026 12:00 PT (= Wed 2 Dec 03:00 WIB)
      if they still haven't arrived — recheck, then contact Devpost/Kiro support
      with the Kiro User ID above if still missing after 2–3 days
- [ ] Submit on Devpost before Sat 5 Dec 2026 05:00 WIB — no extensions
