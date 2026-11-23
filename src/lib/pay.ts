/**
 * Pay-flow pure helpers for KiroPay.
 *
 * These are the parts of the buyer payment flow that do not need a wallet
 * or the network, so they live in `src/lib` (unit-testable) instead of
 * inside the `PayPanel` component:
 *
 *   - {@link isUserRejection} classifies a `writeContract` failure as a
 *     user-rejected signature (retry allowed, no alarm) versus a real
 *     failure.
 *   - {@link buildReceiptUrl} builds the receipt-page URL for a verified
 *     payment, carrying the invoice payload so the receipt page can render
 *     without a wallet (Req 6).
 *
 * This module imports only from `./invoice` and `./verify` (siblings). It
 * never imports from `src/app` or `src/components`.
 */

import {
  encodeInvoiceLink,
  type Invoice,
  type InvoiceLinkPayload,
} from "./invoice";
import { transferLogSender, type PaymentLog } from "./verify";

/**
 * Detect whether a `writeContract` error means the user rejected the
 * signature in their wallet. wagmi/viem surface this as a
 * `UserRejectedRequestError` (name) or an EIP-1193 code 4001, and some
 * wallets only put "User rejected the request" / "User denied …" in the
 * message. Anything else (insufficient funds, RPC errors, …) is NOT a
 * rejection and must be shown as a real failure instead.
 */
export function isUserRejection(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }
  const err = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  if (err.name === "UserRejectedRequestError") {
    return true;
  }
  if (err.code === 4001) {
    return true;
  }
  const message = typeof err.message === "string" ? err.message : "";
  const shortMessage =
    typeof err.shortMessage === "string" ? err.shortMessage : "";
  return /user rejected|rejected the request|user denied/i.test(
    `${message} ${shortMessage}`,
  );
}

/**
 * Build the receipt-page URL for a verified payment: the transaction hash
 * as the route segment plus the invoice payload in the `data` query param,
 * so the receipt page can decode the invoice without a wallet connection
 * (Req 6) and without a server lookup.
 */
export function buildReceiptUrl(
  txHash: `0x${string}`,
  payload: InvoiceLinkPayload,
): string {
  const invoice: Invoice = { ...payload, status: "unpaid", txHash: null };
  return `/receipt/${txHash}?data=${encodeInvoiceLink(invoice)}`;
}

/** On-chain details shown on the receipt (Req 6): buyer, block, time. */
export interface ReceiptChainDetails {
  /**
   * The address that sent the payment — the USDC Transfer sender, falling
   * back to `receipt.from` when the receipt carries no USDC Transfer log.
   */
  buyer: `0x${string}`;
  /** The block the payment transaction was included in. */
  blockNumber: bigint;
  /** The block's timestamp (seconds since epoch). */
  timestamp: bigint;
}

/**
 * Minimal public client shape for receipt enrichment: only the two reads
 * the receipt page needs. Real viem `PublicClient` values are structurally
 * assignable, and the shape is trivial to mock in tests.
 */
export interface ReceiptChainClient {
  getTransactionReceipt(args: { hash: `0x${string}` }): Promise<{
    from: `0x${string}`;
    blockNumber: bigint;
    status: string;
    /**
     * Receipt logs. Optional so older mocks (and minimal clients) keep
     * working — when absent, the buyer falls back to `from`.
     */
    logs?: PaymentLog[];
  }>;
  getBlock(args: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
}

/**
 * Fetch the on-chain details for a receipt: the payment sender, the block
 * number, and the block timestamp, from the transaction receipt and its
 * block. Throws a plain-language Error when the transaction was reverted
 * or the chain cannot be read — the receipt page catches this and still
 * shows the invoice + tx hash from the URL, without the on-chain rows.
 */
export async function fetchReceiptChainDetails(
  client: ReceiptChainClient,
  txHash: `0x${string}`,
): Promise<ReceiptChainDetails> {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("The transaction was reverted on-chain.");
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  // The payer is the sender of the USDC Transfer in the receipt. Wallets
  // that relay transactions (MetaMask Smart Transactions, smart/AA wallets)
  // submit from a relayer address, so `receipt.from` is the relayer — the
  // Transfer event still carries the real payer. Fall back to
  // `receipt.from` when the receipt carries no USDC Transfer log.
  let buyer = receipt.from;
  for (const log of receipt.logs ?? []) {
    const sender = transferLogSender(log);
    if (sender !== null) {
      buyer = sender;
      break;
    }
  }
  return {
    buyer,
    blockNumber: receipt.blockNumber,
    timestamp: block.timestamp,
  };
}
