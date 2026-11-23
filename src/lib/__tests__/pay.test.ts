import { describe, it, expect } from "vitest";
import {
  buildReceiptUrl,
  fetchReceiptChainDetails,
  isUserRejection,
  type ReceiptChainClient,
} from "../pay";
import { USDC_ADDRESS } from "../chain";
import type { PaymentLog } from "../verify";
import {
  decodeInvoiceLink,
  type InvoiceLinkPayload,
} from "../invoice";

const VALID_SELLER = "0x1234567890123456789012345678901234567890" as `0x${string}`;
const TX_HASH =
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

function makePayload(overrides: Partial<InvoiceLinkPayload> = {}): InvoiceLinkPayload {
  return {
    id: "abcdefghij12",
    seller: VALID_SELLER,
    amount: "1500000",
    description: "Test invoice",
    dueDate: null,
    createdAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isUserRejection", () => {
  it("detects the viem UserRejectedRequestError by name", () => {
    const err = new Error("User rejected the request.");
    err.name = "UserRejectedRequestError";
    expect(isUserRejection(err)).toBe(true);
  });

  it("detects EIP-1193 code 4001", () => {
    expect(isUserRejection({ code: 4001, message: "User rejected." })).toBe(
      true,
    );
  });

  it("detects a rejection described only in the message", () => {
    expect(
      isUserRejection(new Error("User rejected the request.")),
    ).toBe(true);
  });

  it("detects a rejection described only in shortMessage", () => {
    expect(
      isUserRejection({ shortMessage: "User denied transaction signature." }),
    ).toBe(true);
  });

  it("does not treat insufficient funds as a rejection", () => {
    expect(
      isUserRejection(new Error("insufficient funds for gas * price + value")),
    ).toBe(false);
  });

  it("does not treat an RPC error as a rejection", () => {
    expect(isUserRejection(new Error("Internal JSON-RPC error."))).toBe(false);
  });

  it("does not treat a generic error as a rejection", () => {
    expect(isUserRejection(new Error("Something went wrong."))).toBe(false);
  });

  it("returns false for null, undefined, strings, and numbers", () => {
    expect(isUserRejection(null)).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
    expect(isUserRejection("User rejected the request.")).toBe(false);
    expect(isUserRejection(4001)).toBe(false);
  });
});

describe("buildReceiptUrl", () => {
  it("puts the tx hash in the path and the invoice in the data param", () => {
    const url = buildReceiptUrl(TX_HASH, makePayload());
    expect(url.startsWith(`/receipt/${TX_HASH}?data=`)).toBe(true);
  });

  it("round-trips the invoice payload through the data param", () => {
    const payload = makePayload();
    const url = buildReceiptUrl(TX_HASH, payload);
    const data = new URL(url, "https://example.com").searchParams.get("data");
    expect(data).not.toBeNull();
    const decoded = decodeInvoiceLink(data as string, payload.id);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.seller).toBe(payload.seller);
    expect(decoded.amount).toBe(payload.amount);
    expect(decoded.description).toBe(payload.description);
    expect(decoded.dueDate).toBe(payload.dueDate);
    expect(decoded.createdAt).toBe(payload.createdAt);
  });
});

describe("fetchReceiptChainDetails", () => {
  const BUYER =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

  function makeClient(
    overrides: Partial<ReceiptChainClient> = {},
  ): ReceiptChainClient {
    return {
      getTransactionReceipt: async () => ({
        from: BUYER,
        blockNumber: 12345678n,
        status: "success",
      }),
      getBlock: async () => ({ timestamp: 1795192800n }),
      ...overrides,
    };
  }

  it("returns the buyer, block number, and timestamp", async () => {
    const details = await fetchReceiptChainDetails(makeClient(), TX_HASH);
    expect(details.buyer).toBe(BUYER);
    expect(details.blockNumber).toBe(12345678n);
    expect(details.timestamp).toBe(1795192800n);
  });

  it("returns the Transfer sender as buyer for a relayed transaction", async () => {
    // The wallet relayed the tx (receipt.from is the relayer), but the
    // USDC Transfer in the receipt still carries the real payer.
    const RELAYER =
      "0x7777777777777777777777777777777777777777" as `0x${string}`;
    const PAYER =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
    const TRANSFER_TOPIC =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as `0x${string}`;
    const addrTopic = (addr: `0x${string}`): `0x${string}` =>
      ("0x" + "0".repeat(24) + addr.slice(2).toLowerCase()) as `0x${string}`;
    const transferLog: PaymentLog = {
      address: USDC_ADDRESS,
      topics: [TRANSFER_TOPIC, addrTopic(PAYER), addrTopic(VALID_SELLER)],
      data: ("0x" +
        (1500000n).toString(16).padStart(64, "0")) as `0x${string}`,
      transactionHash: TX_HASH,
      blockNumber: 12345678n,
    };
    const client = makeClient({
      getTransactionReceipt: async () => ({
        from: RELAYER,
        blockNumber: 12345678n,
        status: "success",
        logs: [transferLog],
      }),
    });
    const details = await fetchReceiptChainDetails(client, TX_HASH);
    // viem decodes address topics as checksummed (mixed-case); compare
    // case-insensitively, as the rest of the codebase does.
    expect(details.buyer.toLowerCase()).toBe(PAYER);
  });

  it("asks for the receipt of the given tx hash and the block of that receipt", async () => {
    const seen: { hash?: `0x${string}`; blockNumber?: bigint } = {};
    const client = makeClient({
      getTransactionReceipt: async ({ hash }) => {
        seen.hash = hash;
        return { from: BUYER, blockNumber: 42n, status: "success" };
      },
      getBlock: async ({ blockNumber }) => {
        seen.blockNumber = blockNumber;
        return { timestamp: 100n };
      },
    });
    await fetchReceiptChainDetails(client, TX_HASH);
    expect(seen.hash).toBe(TX_HASH);
    expect(seen.blockNumber).toBe(42n);
  });

  it("throws when the transaction was reverted", async () => {
    const client = makeClient({
      getTransactionReceipt: async () => ({
        from: BUYER,
        blockNumber: 1n,
        status: "reverted",
      }),
    });
    await expect(fetchReceiptChainDetails(client, TX_HASH)).rejects.toThrow(
      /reverted/,
    );
  });

  it("propagates RPC errors so the page can degrade gracefully", async () => {
    const client = makeClient({
      getTransactionReceipt: async () => {
        throw new Error("Internal JSON-RPC error.");
      },
    });
    await expect(fetchReceiptChainDetails(client, TX_HASH)).rejects.toThrow(
      /Internal JSON-RPC error/,
    );
  });
});
