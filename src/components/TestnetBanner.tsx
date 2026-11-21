import React from "react";

import { FAUCET_URL } from "@/lib/chain";

/**
 * Stitched divider — the small "Frankenstein" visual motif for KiroPay
 * (task 16). A dashed seam with cross-stitch marks, echoing the category
 * story: Web2 invoicing + Web3 payments + on-chain verification, stitched
 * into one flow. Decorative only (aria-hidden), so it never affects
 * readability or screen-reader output.
 */
export function StitchedDivider() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 text-slate-600">
      <span className="flex-1 border-t border-dashed border-slate-700" />
      <span className="text-xs tracking-[0.3em]">× × ×</span>
      <span className="flex-1 border-t border-dashed border-slate-700" />
    </div>
  );
}

/**
 * Testnet notice banner (task 16, Req 9). Rendered in the root layout so it
 * is visible on every page: this is a Base Sepolia testnet demo using test
 * USDC only — no real money. Links to the Circle faucet so a judge can get
 * test USDC (and test ETH) with one click.
 */
export function TestnetBanner() {
  return (
    <div className="border-b border-amber-800/60 bg-amber-950/60">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-2 gap-y-1 px-6 py-2.5 text-sm text-amber-200">
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-bold tracking-wide text-amber-300">
          TESTNET
        </span>
        <span>Demo on Base Sepolia — test USDC only, no real money.</span>
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-amber-300 underline hover:text-amber-200"
        >
          Get test USDC from the Circle faucet
        </a>
      </div>
      <div className="mx-auto max-w-2xl px-6 pb-2">
        <StitchedDivider />
      </div>
    </div>
  );
}
