---
inclusion: always
---

# Project Structure — KiroPay

## Layout

```
kiropay/
├── LICENSE
├── README.md
├── package.json
├── .gitignore                 # never ignore .kiro/
├── .kiro/
│   ├── specs/
│   │   └── kiropay/           # requirements.md, design.md, tasks.md
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md
│   └── hooks/
│       └── kiropay-quality-check.json
├── src/
│   ├── app/
│   │   ├── page.tsx           # seller dashboard + create invoice
│   │   ├── pay/
│   │   │   └── [id]/
│   │   │       └── page.tsx   # buyer payment page
│   │   ├── receipt/
│   │   │   └── [txHash]/
│   │   │       └── page.tsx   # receipt view
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── InvoiceForm.tsx    # create-invoice form
│   │   ├── InvoiceCard.tsx    # one invoice row in the dashboard
│   │   ├── PayPanel.tsx       # buyer pay box (connect + pay + status)
│   │   ├── ReceiptCard.tsx    # receipt display
│   │   └── WalletButton.tsx   # connect/disconnect + network guard
│   └── lib/
│       ├── chain.ts           # Base Sepolia config, USDC address, RPC
│       ├── invoice.ts         # Invoice type, encode/decode link payload
│       ├── store.ts           # localStorage CRUD for seller invoices
│       ├── verify.ts          # on-chain payment verification
│       └── money.ts           # USDC parse/format helpers (6 decimals)
```

## Naming

- Files: PascalCase for React components, camelCase for lib modules.
- Routes: `/` seller dashboard, `/pay/[id]` buyer page,
  `/receipt/[txHash]` receipt page.
- Invoice IDs: `nanoid`-style URL-safe random strings, 12 chars.
- Test files: colocated `*.test.ts(x)` next to the module they test.

## Rules

- `src/lib/` must not import from `src/components/` or `src/app/`.
  Pure logic lives in `lib` so it can be unit-tested without rendering.
- Every new feature starts as a spec under `.kiro/specs/` — no code
  before `requirements.md` → `design.md` → `tasks.md` are reviewed.
- Keep `tasks.md` checkboxes in sync: mark a task done only after its
  tests pass and `npm run type-check` is green.
