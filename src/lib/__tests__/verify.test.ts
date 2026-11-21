import { describe, it, expect, vi } from "vitest";

import {
  checkInvoicePayment,
  findPaymentTransfer,
  scanForPayment,
  type PaymentLog,
  type PaymentReceipt,
  type PaymentScannerClient,
  type PaymentScannerClientWithBlock,
} from "../verify";
import { USDC_ADDRESS } from "../chain";
import type { Invoice } from "../invoice";

// --- Shared test constants --------------------------------------------------

const SELLER = "0x1234567890123456789012345678901234567890" as `0x${string}`;
const BUYER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;
// A second buyer used to assert "first match wins".
const BUYER_2 = ("0x" + "deadbeef".repeat(5)) as `0x${string}`;
// A non-USDC contract address, used to confirm wrong-address logs are ignored.
const OTHER_ADDRESS = ("0x" + "11".repeat(20)) as `0x${string}`;

const AMOUNT = "1500000"; // base-unit integer string (1.5 USDC)
const AMOUNT_BI = 1500000n;

const TX_HASH = ("0x" + "ab".repeat(32)) as `0x${string}`;
const TX_HASH_2 = ("0x" + "cd".repeat(32)) as `0x${string}`;
const BLOCK = 100n;

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as `0x${string}`;
// A 32-byte topic that is NOT the Transfer signature.
const OTHER_TOPIC = ("0x" + "1".repeat(64)) as `0x${string}`;

// --- Mock log/receipt/invoice builders --------------------------------------

/** Pad an address into a 32-byte topic (lowercase, left-zero-padded). */
function addrTopic(addr: `0x${string}`): `0x${string}` {
  return ("0x" + "0".repeat(24) + addr.slice(2).toLowerCase()) as `0x${string}`;
}

/** Encode a uint256 value as a 32-byte hex `data` field. */
function valueData(value: bigint): `0x${string}` {
  return ("0x" + value.toString(16).padStart(64, "0")) as `0x${string}`;
}

/** Build a USDC Transfer log (defaults match the invoice: buyer→seller, amount). */
function transferLog(overrides: {
  from?: `0x${string}`;
  to?: `0x${string}`;
  value?: bigint;
  address?: `0x${string}`;
  topic0?: `0x${string}`;
  data?: `0x${string}`;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint | null;
} = {}): PaymentLog {
  const from = overrides.from ?? BUYER;
  const to = overrides.to ?? SELLER;
  const value = overrides.value ?? AMOUNT_BI;
  const topic0 = overrides.topic0 ?? TRANSFER_TOPIC;
  return {
    address: overrides.address ?? USDC_ADDRESS,
    topics: [topic0, addrTopic(from), addrTopic(to)],
    data: overrides.data ?? valueData(value),
    transactionHash: overrides.transactionHash ?? TX_HASH,
    blockNumber: overrides.blockNumber ?? BLOCK,
  };
}

/** Build a receipt wrapping the given logs (buyer is the receipt sender). */
function receipt(
  logs: PaymentLog[],
  overrides: {
    from?: `0x${string}`;
    transactionHash?: `0x${string}`;
    blockNumber?: bigint;
  } = {},
): PaymentReceipt {
  return {
    from: overrides.from ?? BUYER,
    transactionHash: overrides.transactionHash ?? TX_HASH,
    blockNumber: overrides.blockNumber ?? BLOCK,
    logs,
  };
}

/** Build an invoice for SELLER / AMOUNT. */
function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "abcdefghij12",
    seller: SELLER,
    amount: AMOUNT,
    description: "Test invoice",
    dueDate: null,
    createdAt: "2026-12-01T00:00:00.000Z",
    status: "unpaid",
    txHash: null,
    ...overrides,
  };
}

// --- Mock public client (no network) ---------------------------------------

type GetLogsArgs = Parameters<PaymentScannerClient["getLogs"]>[0];

/** Create a mock scanner client that returns canned logs for every getLogs call. */
function makeClient(logs: PaymentLog[]) {
  const getLogs = vi.fn<(args: GetLogsArgs) => Promise<PaymentLog[]>>(
    async () => logs,
  );
  const client: PaymentScannerClient = { getLogs };
  return { client, getLogs };
}

// --- findPaymentTransfer ----------------------------------------------------

describe("findPaymentTransfer", () => {
  it("matches a valid USDC Transfer (from=buyer, to=seller, value=amount)", () => {
    const result = findPaymentTransfer(receipt([transferLog()]), invoice());
    expect(result.matched).toBe(true);
    if (result.matched === true) {
      expect(result.txHash).toBe(TX_HASH);
      expect(result.blockNumber).toBe(BLOCK);
      // viem decodes indexed addresses as checksummed (mixed-case), so
      // compare case-insensitively.
      expect(result.from.toLowerCase()).toBe(BUYER);
      expect(result.to.toLowerCase()).toBe(SELLER);
      expect(result.value).toBe(AMOUNT_BI);
    }
  });

  it("returns matched:false with 'No USDC Transfer' when there is no USDC log", () => {
    // A Transfer log emitted by a non-USDC contract is ignored.
    const result = findPaymentTransfer(
      receipt([transferLog({ address: OTHER_ADDRESS })]),
      invoice(),
    );
    expect(result.matched).toBe(false);
    if (result.matched === false) {
      expect(result.reason).toMatch(/No USDC Transfer/);
    }
  });

  it("returns matched:false ('does not match') when the recipient is wrong", () => {
    const result = findPaymentTransfer(
      receipt([transferLog({ to: OTHER_ADDRESS })]),
      invoice(),
    );
    expect(result.matched).toBe(false);
    if (result.matched === false) {
      expect(result.reason).toMatch(/does not match/);
    }
  });

  it("returns matched:false when the sender is wrong", () => {
    const result = findPaymentTransfer(
      receipt([transferLog({ from: BUYER_2 })]),
      invoice(),
    );
    expect(result.matched).toBe(false);
  });

  it("returns matched:false when the value is wrong", () => {
    const result = findPaymentTransfer(
      receipt([transferLog({ value: 999999n })]),
      invoice(),
    );
    expect(result.matched).toBe(false);
  });

  it("ignores a non-USDC log with a Transfer topic and a USDC log with a non-Transfer topic", () => {
    const nonUsdcTransfer = transferLog({ address: OTHER_ADDRESS }); // Transfer, but wrong contract
    const usdcNonTransfer: PaymentLog = {
      // USDC contract, but topic0 is not the Transfer signature
      address: USDC_ADDRESS,
      topics: [OTHER_TOPIC, addrTopic(BUYER), addrTopic(SELLER)],
      data: valueData(AMOUNT_BI),
      transactionHash: TX_HASH,
      blockNumber: BLOCK,
    };
    const result = findPaymentTransfer(
      receipt([nonUsdcTransfer, usdcNonTransfer]),
      invoice(),
    );
    expect(result.matched).toBe(false);
    if (result.matched === false) {
      expect(result.reason).toMatch(/No USDC Transfer/);
    }
  });

  it("matches when a valid USDC Transfer is present among other logs", () => {
    const otherLog = transferLog({ address: OTHER_ADDRESS }); // ignored
    const matchLog = transferLog(); // buyer → seller, exact amount
    const result = findPaymentTransfer(
      receipt([otherLog, matchLog]),
      invoice(),
    );
    expect(result.matched).toBe(true);
    if (result.matched === true) {
      expect(result.txHash).toBe(TX_HASH);
      expect(result.from.toLowerCase()).toBe(BUYER);
      expect(result.to.toLowerCase()).toBe(SELLER);
      expect(result.value).toBe(AMOUNT_BI);
    }
  });
});

// --- scanForPayment ---------------------------------------------------------

describe("scanForPayment", () => {
  it("returns the first matching log as a ScannedPayment", async () => {
    const { client, getLogs } = makeClient([transferLog()]);
    const result = await scanForPayment(client, invoice(), BLOCK);
    expect(result).not.toBeNull();
    expect(result!.txHash).toBe(TX_HASH);
    expect(result!.blockNumber).toBe(BLOCK);
    expect(result!.from.toLowerCase()).toBe(BUYER);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it("returns null when no returned log has the matching value", async () => {
    const { client } = makeClient([transferLog({ value: 999999n })]);
    const result = await scanForPayment(client, invoice(), BLOCK);
    expect(result).toBeNull();
  });

  it("returns null when getLogs returns an empty array", async () => {
    const { client } = makeClient([]);
    const result = await scanForPayment(client, invoice(), BLOCK);
    expect(result).toBeNull();
  });

  it("returns the first matching log when several are returned", async () => {
    const log1 = transferLog({
      from: BUYER,
      transactionHash: TX_HASH,
      blockNumber: BLOCK,
    });
    const log2 = transferLog({
      from: BUYER_2,
      transactionHash: TX_HASH_2,
      blockNumber: 101n,
    });
    const { client } = makeClient([log1, log2]);
    const result = await scanForPayment(client, invoice(), BLOCK);
    expect(result).not.toBeNull();
    expect(result!.txHash).toBe(TX_HASH);
    expect(result!.blockNumber).toBe(BLOCK);
    expect(result!.from.toLowerCase()).toBe(BUYER);
  });

  it("calls getLogs with the USDC address, Transfer topic, seller 'to' topic, and the given fromBlock", async () => {
    const { client, getLogs } = makeClient([]);
    await scanForPayment(client, invoice(), BLOCK);
    expect(getLogs).toHaveBeenCalledTimes(1);
    const args = getLogs.mock.calls[0][0];
    expect(args.address).toBe(USDC_ADDRESS);
    expect(args.topics[0]).toBe(TRANSFER_TOPIC);
    expect(args.topics[2]).toBe(addrTopic(SELLER));
    expect(args.fromBlock).toBe(BLOCK);
    expect(args.toBlock).toBe("latest");
  });
});

// --- checkInvoicePayment ----------------------------------------------------

/** Mock client with a controllable current block number. */
function makeBlockClient(logs: PaymentLog[], blockNumber: bigint) {
  const getLogs = vi.fn<(args: GetLogsArgs) => Promise<PaymentLog[]>>(
    async () => logs,
  );
  const getBlockNumber = vi.fn<() => Promise<bigint>>(async () => blockNumber);
  const client: PaymentScannerClientWithBlock = { getLogs, getBlockNumber };
  return { client, getLogs, getBlockNumber };
}

describe("checkInvoicePayment", () => {
  it("finds a payment, scanning from the estimated creation block", async () => {
    // Created 2026-12-01T00:00Z, checked 1h later (3600s = 1800 blocks at
    // 2s/block) + 7200-block margin → fromBlock = 1,000,000 - 9,000.
    const { client, getLogs } = makeBlockClient(
      [transferLog()],
      1_000_000n,
    );
    const result = await checkInvoicePayment(
      client,
      invoice(),
      new Date("2026-12-01T01:00:00.000Z"),
    );
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs.mock.calls[0][0].fromBlock).toBe(991000n);
    expect(result).not.toBeNull();
    expect(result!.txHash).toBe(TX_HASH);
    expect(result!.blockNumber).toBe(BLOCK);
    expect(result!.from.toLowerCase()).toBe(BUYER);
  });

  it("returns null when the scan finds no matching Transfer", async () => {
    const { client } = makeBlockClient([], 1_000_000n);
    const result = await checkInvoicePayment(
      client,
      invoice(),
      new Date("2026-12-01T01:00:00.000Z"),
    );
    expect(result).toBeNull();
  });

  it("clamps fromBlock to 0 when the chain is younger than the lookback", async () => {
    const { client, getLogs } = makeBlockClient([], 100n);
    await checkInvoicePayment(
      client,
      invoice({ createdAt: "2026-11-01T00:00:00.000Z" }),
      new Date("2026-12-01T00:00:00.000Z"),
    );
    expect(getLogs.mock.calls[0][0].fromBlock).toBe(0n);
  });

  it("propagates a client failure so the UI can show a retryable error", async () => {
    const getLogs = vi.fn(async () => {
      throw new Error("RPC down");
    });
    const getBlockNumber = vi.fn(async () => 1_000_000n);
    const client: PaymentScannerClientWithBlock = { getLogs, getBlockNumber };
    await expect(
      checkInvoicePayment(client, invoice(), new Date("2026-12-01T01:00:00.000Z")),
    ).rejects.toThrow(/RPC down/);
  });
});
