# KiroPay — Demo video narration script (< 3 min)

Prepared 2026-11-23 ~09:00 WIB. Companion to the shot list in
`~/workspace/kiropay/DEVPOST-DRAFT.md` (shots 1–5) and the E2E script in
`~/workspace/kiropay-e2e-test-script.md`.

## Gate — do NOT record yet

Record ONLY after the 2 USDC payment shows as PAID in the app — the video
must show a REAL paid invoice. Update 2026-11-23 ~09:28 WIB: the payment
HAS landed on-chain — 2 USDC, invoice "testing pay for you", seller
0xD0F4fBD73e5800895104823a208645e1E6370E4d, buyer 0xA79a9764A4BeC932efFc0658BCc28270bd13bdec,
tx 0x1cfe29448f64ba0852fe493e0eeda0fd3bc7f73137aa01bbefc609d564aad89f,
block 62394946. BUT the app's pay-flow verification rejected it (the tx went
via relayer 0xdb9b1e94, so the on-chain sender 0xc066ac5d ≠ buyer wallet),
and "Check payment" still fails ("Could not reach the network") because
sepolia.base.org caps log scans at 200 blocks. The fix (PublicNode fallback
RPC in src/lib/chain.ts) is implemented locally and tested 136/136 — it is
NOT pushed yet: the user said 09:37 WIB "coba 1x lagi baru push github"
(retry Check payment once, then push). After the push + redeploy, click
"Check payment" on the 2 USDC invoice — it should flip to paid, and THAT is
the invoice to record. Do NOT pay again (would double-pay). The old 20 USDC
"test adm" invoice is expired (due 21 Nov) and was never paid; the 5 USDC
invoice expired too (due date mistyped as 2006-11-20). Use the 2 USDC invoice
below for the narration — say "2 USDC", not 20 or 1.

## How to record (user does this himself — Muse has no screen access)

- Screen-record Chrome on the PC (Windows Game Bar: Win + G, or OBS).
  Record at 1080p, keep the browser window maximized, hide bookmarks bar.
- Two Chrome profiles ready before recording: profile 1 = seller wallet,
  profile 2 (or incognito) = buyer wallet. Both on Base Sepolia.
- Read the narration lines aloud while doing each shot, slowly. Total
  target: ~2:30–2:50. If a take goes wrong, re-record just that shot —
  the shots can be cut together.
- Upload as PUBLIC on YouTube (Devpost requires a public link), title
  suggestion: "KiroPay — get paid in stablecoins with a link (Kiroween 2026)".
- After upload, paste the YouTube link into the Devpost submission.

## Narration (read aloud, in English — one line per shot)

### Shot 1 — (0:00–0:20) Live app intro
Show: https://kiropay-iota.vercel.app/ — testnet banner, "Create an invoice" form.
Say: "This is KiroPay. A seller creates an invoice in USDC, shares a payment
link, and the buyer pays straight from their wallet. No backend, no database,
no custodian in between."

### Shot 2 — (0:20–0:50) Seller creates the invoice
Show: fill in the form, click create, copy the payment link.
Say: "I create an invoice — 2 USDC, testing pay for you — and KiroPay gives
me a payment link. The invoice lives in my browser, so there is zero server
state. I just share the link."

### Shot 3 — (0:50–1:40) Buyer pays
Show: second Chrome profile, open the link, connect wallet, click Pay,
confirm in MetaMask.
Say: "On the buyer side, I open the link, connect my wallet, and pay with one
USDC transfer. KiroPay checks I am on Base Sepolia first, and warns me if my
balance is short."

### Shot 4 — (1:40–2:20) Receipt, verified on-chain
Show: receipt page — invoice ID, amount, description, seller and buyer
addresses, tx hash, block number, timestamp. Click through to
sepolia.basescan.org showing the USDC transfer.
Say: "And here is the proof. KiroPay reads the chain itself and shows a
receipt — transaction hash, block number, and timestamp. Anyone can re-check
the payment on the explorer. The app trusts the chain, not itself." (On
screen the receipt for this invoice reads: 2 USDC, tx
0x1cfe29448f64ba0852fe493e0eeda0fd3bc7f73137aa01bbefc609d564aad89f,
block 62394946.)

### Shot 5 — (2:20–2:50) Seller dashboard + close
Show: back on the seller dashboard, invoice status paid (or click
"Check payment").
Say: "Back on the seller dashboard, the invoice is paid. KiroPay — invoice,
link, pay, verified. Built solo with Kiro, spec-first: the builder can't code,
so every line was written through Kiro."

## Before you submit (checklist)

- [ ] Task 17 E2E passed, tx hash verified on-chain
- [ ] Video recorded, < 3 min, uploaded PUBLIC to YouTube
- [ ] YouTube link pasted into the Devpost submission
- [ ] Devpost description + "How Kiro was used" pasted (see DEVPOST-DRAFT.md)
- [ ] README deadline fix pushed (local edit done; say "gas push" to Muse)
- [ ] Submit on Devpost before Sat 5 Dec 2026 05:00 WIB — no extensions
