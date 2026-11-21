---
inclusion: always
---

# Tech — KiroPay

## Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript `strict`
- **Wallet**: wagmi 2 (injected + Coinbase Wallet connectors — no
  WalletConnect project ID required)
- **Chain client**: viem 2 (reads, receipts, event logs)
- **State**: @tanstack/react-query (via wagmi), React state, localStorage
- **Styling**: Tailwind CSS
- **Tests**: Vitest
- **Deploy**: Vercel (static frontend, no server)

## Chain configuration (Base Sepolia testnet — verify on-chain before release)

| Item | Value |
| --- | --- |
| Chain ID | `84532` |
| RPC | `https://sepolia.base.org` |
| USDC (Circle testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| USDC decimals | `6` |
| Explorer | `https://sepolia.basescan.org` |
| Test USDC faucet | `https://faucet.circle.com` |

## Conventions

- TypeScript `strict`. No `any`. No `// @ts-ignore` — fix the type.
- All chain reads go through viem (`createPublicClient`, `getTransactionReceipt`,
  `getLogs`). All wallet writes go through wagmi (`useWriteContract`,
  `useWaitForTransactionReceipt`).
- Amounts: always keep USDC as `bigint` in 6-decimal base units internally.
  Convert to/from display strings only at the UI boundary
  (`parseUnits` / `formatUnits` with 6 decimals). Never use floats for money.
- Addresses: validate with `isAddress` before use. Never trust an address
  decoded from a URL without validation.
- Payment links: invoice data is base64url-encoded JSON in the URL query.
  The buyer page must validate the decoded payload (schema + address +
  positive amount) and refuse to render a payment for malformed data.
- Never log, store, or transmit private keys or mnemonics. The app never
  asks for them.
- No secrets in the repo. The only config is public chain constants.
- Errors must be shown to the user in plain language (wrong network, rejected
  signature, insufficient USDC, receipt timeout), never a raw stack trace.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run type-check` — `tsc --noEmit`
- `npm run lint` — `next lint`
- `npm run test` — `vitest run`
