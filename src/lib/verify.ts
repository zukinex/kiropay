/**
 * On-chain payment verification for KiroPay.
 *
 * A payment is only "paid" when the chain says so: a confirmed USDC
 * `Transfer` event with `from` = buyer, `to` = seller, and `value` = the
 * exact invoice amount (6-decimal base units). This module provides two
 * pure-ish verifiers built on top of viem:
 *
 *   - {@link findPaymentTransfer} inspects a transaction receipt's logs and
 *     matches the Transfer event against an invoice. Used right after the
 *     buyer pays.
 *   - {@link scanForPayment} re-scans the chain for a matching Transfer to the
 *     seller, used by the dashboard "Check payment" action. It takes a tiny
 *     {@link PaymentScannerClient} so the public client can be mocked in tests
 *     without hitting the network.
 *
 * Design notes:
 *   - The exported types are deliberately structural and minimal so that real
 *     viem `TransactionReceipt` / `Log` / `PublicClient` values are
     structurally assignable, yet trivial to hand-build in tests.
 *   - Money is handled as `bigint` base units only — `invoice.amount` is a
 *     base-unit integer string, compared via `BigInt(invoice.amount)`. The
 *     `parseUsdc`/`formatUsdc` helpers (human decimals) are NOT used here.
 *   - Addresses are compared case-insensitively (`toLowerCase()`); viem
 *     decodes indexed `address` topics as checksummed (mixed-case), so we
 *     never rely on exact case.
 *
 * This module imports only from `viem` (`decodeEventLog`, `type Hex`) and the
 * siblings `./chain` (USDC address) and `./invoice` (the `Invoice` type). It
 * never imports from `src/app` or `src/components`, keeping it unit-testable
 * without rendering anything.
 */

import { decodeEventLog, type Hex } from "viem";

import { USDC_ADDRESS } from "./chain";
import type { Invoice } from "./invoice";

// --- Structural types (mock-friendly + viem-assignable) ---------------------

/** A single log, minimal subset of viem `Log`. */
export interface PaymentLog {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  transactionHash: `0x${string}` | null;
  blockNumber: bigint | null;
}

/** A transaction receipt, minimal subset of viem `TransactionReceipt`. */
export interface PaymentReceipt {
  from: `0x${string}`;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logs: PaymentLog[];
}

/** Minimal public client shape: only `getLogs` is needed for re-scanning. */
export interface PaymentScannerClient {
  getLogs(args: {
    address: `0x${string}`;
    topics: (`0x${string}` | null)[];
    fromBlock: bigint;
    toBlock: "latest";
  }): Promise<PaymentLog[]>;
}

/** Outcome of matching a receipt's logs against an invoice. */
export type PaymentTransferResult =
  | {
      matched: true;
      txHash: `0x${string}`;
      blockNumber: bigint;
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
    }
  | { matched: false; reason: string };

/** A payment found by re-scanning the chain. */
export interface ScannedPayment {
  txHash: `0x${string}`;
  blockNumber: bigint;
  from: `0x${string}`;
}

// --- Constants --------------------------------------------------------------

/**
 * keccak256("Transfer(address,address,uint256)") — the USDC `Transfer` event
 * signature topic. ERC-20 `Transfer(address indexed from, address indexed to,
 * uint256 value)` emits this as topic0, with `from` in topic1 and `to` in
 * topic2 (both 32-byte left-padded), and `value` (non-indexed) in `data`.
 */
const TRANSFER_TOPIC: `0x${string}` =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Single-event ABI for the ERC-20 `Transfer` event. */
const transferEventAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

/** Decoded `Transfer` event args. */
interface DecodedTransfer {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
}

// --- Internal helpers -------------------------------------------------------

/**
 * Pad an address into a 32-byte topic: `0x` + 24 hex-zero chars + the
 * address (lowercased). A 20-byte address left-padded to 32 bytes is
 * `0x` + 48 hex chars of zeros... no: 12 bytes = 24 hex chars of zeros,
 * then 40 hex chars of address = 64 hex chars total. This matches the
 * representation viem/EVM nodes use for indexed `address` topics.
 */
function toAddressTopic(addr: `0x${string}`): `0x${string}` {
  return ("0x" + "0".repeat(24) + addr.slice(2).toLowerCase()) as `0x${string}`;
}

/**
 * Decode a log as a USDC `Transfer` event. Returns `null` when the log is not a
 * Transfer (topic0 mismatch / too few topics) or when viem decoding throws
 * (malformed data/topics). The address filter is the caller's responsibility —
 * this only checks the event signature and decodes.
 */
function decodeTransfer(log: PaymentLog): DecodedTransfer | null {
  // A Transfer log has at least topic0 + the two indexed address topics.
  if (log.topics.length < 3) return null;
  if (log.topics[0] !== TRANSFER_TOPIC) return null;
  try {
    const decoded = decodeEventLog({
      abi: transferEventAbi,
      // We verified ≥3 topics above; the cast is runtime-safe.
      topics: log.topics as [Hex, Hex, Hex],
      data: log.data,
    });
    const args = decoded.args;
    // viem decodes address topics (checksummed strings) and the uint256 data
    // (bigint); these guards defend against any future widening and let us
    // narrow the structural type without `any`.
    if (
      typeof args.from === "string" &&
      typeof args.to === "string" &&
      typeof args.value === "bigint"
    ) {
      return {
        from: args.from as `0x${string}`,
        to: args.to as `0x${string}`,
        value: args.value,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Return the `from` address of a USDC `Transfer` log, or `null` when the log
 * is not a USDC Transfer. The Transfer event's `from` is the real payer —
 * for relayed transactions the receipt's `from` is the relayer, not the
 * wallet that sent the USDC — so the receipt page uses this to show who
 * actually paid.
 */
export function transferLogSender(log: PaymentLog): `0x${string}` | null {
  if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) return null;
  const decoded = decodeTransfer(log);
  return decoded === null ? null : decoded.from;
}

// --- Public API -------------------------------------------------------------

/**
 * Verify a payment transaction receipt against an invoice.
 *
 * The payer is `expectedSender` when given — the wallet that initiated the
 * payment (the connected wallet on the pay page) — and `receipt.from`
 * otherwise. Matching the Transfer's `from` against the known payer (not
 * `receipt.from`) is what makes relayed payments verify: wallets that
 * relay or batch transactions (MetaMask Smart Transactions, smart/AA
 * wallets, EIP-7702) submit the tx from a relayer address, so
 * `receipt.from` is the relayer while the Transfer event still carries the
 * real payer in its `from`.
 *
 * Scans the receipt's logs for a USDC `Transfer` event emitted by
 * {@link USDC_ADDRESS} with `from` = payer, `to` = the invoice seller,
 * and `value` = the exact invoice amount.
 *
 * Returns `{ matched: true, ... }` with the matched transfer's details when
 * all three fields match. Returns `{ matched: false, reason }` otherwise,
 * distinguishing a Transfer that was found but does not match the invoice
 * (sender/recipient/amount) from the absence of any USDC Transfer event.
 *
 * `invoice.amount` is a base-unit integer string; it is compared as
 * `BigInt(invoice.amount)` — never parsed through the human-decimal helpers.
 */
export function findPaymentTransfer(
  receipt: PaymentReceipt,
  invoice: Invoice,
  expectedSender?: `0x${string}`,
): PaymentTransferResult {
  const expectedValue = BigInt(invoice.amount);
  const buyer = (expectedSender ?? receipt.from).toLowerCase();
  const seller = invoice.seller.toLowerCase();

  let foundUsdcTransfer = false;

  for (const log of receipt.logs) {
    // Only logs emitted by the USDC contract are candidates.
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;

    const decoded = decodeTransfer(log);
    if (decoded === null) continue; // not a (decodable) Transfer

    foundUsdcTransfer = true;

    if (
      decoded.from.toLowerCase() === buyer &&
      decoded.to.toLowerCase() === seller &&
      decoded.value === expectedValue
    ) {
      return {
        matched: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: decoded.from,
        to: decoded.to,
        value: decoded.value,
      };
    }
  }

  if (foundUsdcTransfer) {
    return {
      matched: false,
      reason:
        "A USDC Transfer event was found but does not match the invoice (sender, recipient, or amount).",
    };
  }
  return {
    matched: false,
    reason: "No USDC Transfer event found in the transaction.",
  };
}

/** A scanner client that can also report the current block number. */
export interface PaymentScannerClientWithBlock extends PaymentScannerClient {
  getBlockNumber(): Promise<bigint>;
}

/**
 * Base Sepolia produces a block roughly every 2 seconds. When re-scanning
 * for a payment we look back from the current block to the invoice's
 * creation, plus this safety margin (7,200 blocks ≈ 4 hours) for clock
 * skew and slow confirmations.
 */
const SCAN_BLOCK_MARGIN = 7200n;

/** Estimated seconds per Base Sepolia block (used for the fromBlock estimate). */
const SECONDS_PER_BLOCK = 2;

/**
 * Check whether an invoice has been paid by re-scanning the chain, used by
 * the dashboard "Check payment" action. Estimates the block the invoice was
 * created at from `createdAt` (current block minus elapsed blocks, plus a
 * safety margin, clamped at 0) and delegates to {@link scanForPayment}.
 * Returns the found payment or `null`. `now` is injectable for tests.
 */
export async function checkInvoicePayment(
  client: PaymentScannerClientWithBlock,
  invoice: Invoice,
  now: Date = new Date(),
): Promise<ScannedPayment | null> {
  const currentBlock = await client.getBlockNumber();
  const createdMs = new Date(invoice.createdAt).getTime();
  const elapsedSec = Number.isNaN(createdMs)
    ? 0
    : Math.max(0, Math.floor((now.getTime() - createdMs) / 1000));
  const blocksBack =
    BigInt(Math.floor(elapsedSec / SECONDS_PER_BLOCK)) + SCAN_BLOCK_MARGIN;
  const fromBlock = currentBlock > blocksBack ? currentBlock - blocksBack : 0n;
  return scanForPayment(client, invoice, fromBlock);
}

/**
 * Re-scan the chain for a matching USDC `Transfer` to the seller for the
 * exact invoice amount, starting at `fromBlock`. Used by the dashboard
 * "Check payment" action.
 *
 * Asks the public client for USDC `Transfer` logs whose `to` topic is the
 * invoice seller (any `from`), then keeps the first log whose `value` equals
 * the invoice amount and which carries a transaction hash and block number.
 * Returns `null` when no log matches. The client is a tiny interface so it
 * can be mocked in tests without network access.
 */
export async function scanForPayment(
  publicClient: PaymentScannerClient,
  invoice: Invoice,
  fromBlock: bigint,
): Promise<ScannedPayment | null> {
  const expectedValue = BigInt(invoice.amount);
  const sellerTopic = toAddressTopic(invoice.seller);

  const logs = await publicClient.getLogs({
    address: USDC_ADDRESS,
    // [Transfer signature, from = any, to = seller]
    topics: [TRANSFER_TOPIC, null, sellerTopic],
    fromBlock,
    toBlock: "latest",
  });

  for (const log of logs) {
    const decoded = decodeTransfer(log);
    if (decoded === null) continue;
    if (
      decoded.value === expectedValue &&
      log.transactionHash !== null &&
      log.blockNumber !== null
    ) {
      return {
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        from: decoded.from,
      };
    }
  }

  return null;
}
