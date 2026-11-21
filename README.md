# KiroPay

**KiroPay** — invoice + payment-link app that accepts stablecoins. A seller creates
an invoice in USDC, shares a payment link, the buyer pays from their wallet, the
payment is verified on-chain, and a receipt is generated.

Built for **Kiroween 2026**, **Frankenstein** category — it stitches together three
technologies that normally never meet:

1. **Web2 invoicing** — create an invoice, share a link, track status.
2. **Web3 wallet payments** — the buyer pays USDC straight from their wallet
   (wagmi + viem, no custodial backend).
3. **On-chain verification** — the app reads the chain directly to confirm the
   payment and issue a receipt. No server, no database, no trust-me step.

## Demo chain (testnet only, no real money)

| Item | Value |
| --- | --- |
| Chain | Base Sepolia (chain ID `84532`) |
| RPC | `https://sepolia.base.org` |
| USDC (Circle testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals) |
| Explorer | `https://sepolia.basescan.org` |
| Test USDC faucet | `https://faucet.circle.com` |

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- wagmi 2 + viem 2 for wallet connect and chain reads
- Tailwind CSS
- No backend. Invoices live in the seller's browser (localStorage); the
  payment link carries the invoice data in the URL, so the link works with
  zero server state.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run type-check # tsc --noEmit
npm run lint
npm run test       # vitest
```

## How it was built (Kiro)

This project was built spec-first with Kiro:

- Spec: `.kiro/specs/kiropay/` — `requirements.md`, `design.md`, `tasks.md`
- Steering: `.kiro/steering/` — `product.md`, `tech.md`, `structure.md`
- Hooks: `.kiro/hooks/kiropay-quality-check.json` — lint on save, type-check
  after each spec task

> **Kiroween rule:** `.kiro/` must stay tracked in the repo. It is
> intentionally NOT in `.gitignore`.

## Submission checklist (Kiroween 2026, Frankenstein)

- [ ] Public GitHub repo with MIT LICENSE at root
- [ ] `.kiro/` at repo root (specs, steering, hooks)
- [ ] Working app URL (deployed, testnet only)
- [ ] Demo video < 3 minutes, public on YouTube
- [ ] Write-up on how Kiro was used
- [ ] Submit on Devpost before Fri 5 Dec 2026, 14:00 PT (05:00 WIB, 6 Dec)

## License

MIT — see [LICENSE](LICENSE).
