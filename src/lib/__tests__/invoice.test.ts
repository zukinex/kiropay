import { describe, it, expect } from "vitest";
import {
  createInvoice,
  decodeInvoiceLink,
  decodeReceiptPayload,
  encodeInvoiceLink,
  generateInvoiceId,
  getDisplayStatus,
  type Invoice,
} from "../invoice";

const VALID_SELLER = "0x1234567890123456789012345678901234567890" as `0x${string}`;
const ID = "abcdefghij12";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: ID,
    seller: VALID_SELLER,
    amount: "1500000",
    description: "Test invoice",
    dueDate: null,
    createdAt: "2026-12-01T00:00:00.000Z",
    status: "unpaid",
    txHash: null,
    ...overrides,
  };
}

// Local base64url encoder (TextEncoder-based, works in Node + browser) used only
// to craft malformed link inputs for the decoder under test.
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function encB64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      out += B64URL[(value >> (bits - 6)) & 0x3f];
      bits -= 6;
    }
  }
  if (bits > 0) {
    out += B64URL[(value << (6 - bits)) & 0x3f];
  }
  return out;
}
function encObj(obj: unknown): string {
  return encB64Url(JSON.stringify(obj));
}
function validObj(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    seller: VALID_SELLER,
    amount: "1500000",
    description: "Test invoice",
    dueDate: null,
    createdAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("encodeInvoiceLink", () => {
  it("round-trips a valid invoice's public fields", () => {
    const invoice = makeInvoice();
    const payload = decodeInvoiceLink(encodeInvoiceLink(invoice), invoice.id);
    expect(payload.id).toBe(invoice.id);
    expect(payload.seller).toBe(invoice.seller);
    expect(payload.amount).toBe(invoice.amount);
    expect(payload.description).toBe(invoice.description);
    expect(payload.dueDate).toBe(invoice.dueDate);
    expect(payload.createdAt).toBe(invoice.createdAt);
  });

  it("does not include status or txHash in the link payload", () => {
    const payload = decodeInvoiceLink(encodeInvoiceLink(makeInvoice()), ID);
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("txHash");
  });

  it("encodes to base64url (no +, /, or =)", () => {
    expect(encodeInvoiceLink(makeInvoice())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trips a unicode description", () => {
    const invoice = makeInvoice({ description: "Café résumé — pay 🧟" });
    const payload = decodeInvoiceLink(encodeInvoiceLink(invoice), invoice.id);
    expect(payload.description).toBe("Café résumé — pay 🧟");
  });

  it("preserves a non-null dueDate", () => {
    const invoice = makeInvoice({ dueDate: "2026-12-31" });
    const payload = decodeInvoiceLink(encodeInvoiceLink(invoice), invoice.id);
    expect(payload.dueDate).toBe("2026-12-31");
  });
});

describe("decodeInvoiceLink — malformed payloads", () => {
  it("rejects bad base64url characters", () => {
    expect(() => decodeInvoiceLink("!!!not-base64!!!", ID)).toThrow(/Invalid payment link data/);
  });

  it("rejects an empty string", () => {
    expect(() => decodeInvoiceLink("", ID)).toThrow(/Invalid payment link data/);
  });

  it("rejects non-JSON content", () => {
    expect(() => decodeInvoiceLink(encB64Url("not json"), ID)).toThrow(/Invalid payment link data/);
  });

  it("rejects an empty object (missing fields)", () => {
    expect(() => decodeInvoiceLink(encObj({}), ID)).toThrow(/Invalid payment link data/);
  });

  it("rejects a payload with missing fields", () => {
    expect(() =>
      decodeInvoiceLink(encObj({ id: ID, seller: VALID_SELLER }), ID),
    ).toThrow(/Invalid payment link data/);
  });

  it("rejects an invalid seller address", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ seller: "0x123" })), ID)).toThrow(
      /Invalid seller address/,
    );
  });

  it("rejects a zero amount", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ amount: "0" })), ID)).toThrow(
      /Invalid invoice amount/,
    );
  });

  it("rejects a negative amount", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ amount: "-5" })), ID)).toThrow(
      /Invalid invoice amount/,
    );
  });

  it("rejects a non-numeric amount", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ amount: "abc" })), ID)).toThrow(
      /Invalid invoice amount/,
    );
  });

  it("rejects when the payload id does not match the expected id", () => {
    expect(() => decodeInvoiceLink(encObj(validObj()), "zzzzzzzzzz99")).toThrow(/does not match/);
  });

  it("rejects a description longer than 140 chars", () => {
    const longDescription = "x".repeat(141);
    expect(() =>
      decodeInvoiceLink(encObj(validObj({ description: longDescription })), ID),
    ).toThrow(/Invalid invoice description/);
  });

  it("rejects a non-string dueDate", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ dueDate: 123 })), ID)).toThrow(
      /Invalid payment link data/,
    );
  });

  it("rejects a non-string createdAt", () => {
    expect(() => decodeInvoiceLink(encObj(validObj({ createdAt: 123 })), ID)).toThrow(
      /Invalid payment link data/,
    );
  });
});

describe("decodeReceiptPayload", () => {
  it("round-trips a valid invoice's public fields", () => {
    const invoice = makeInvoice();
    const payload = decodeReceiptPayload(encodeInvoiceLink(invoice));
    expect(payload.id).toBe(invoice.id);
    expect(payload.seller).toBe(invoice.seller);
    expect(payload.amount).toBe(invoice.amount);
    expect(payload.description).toBe(invoice.description);
    expect(payload.dueDate).toBe(invoice.dueDate);
    expect(payload.createdAt).toBe(invoice.createdAt);
  });

  it("does not require the id to match a path id (receipt path is a tx hash)", () => {
    // The receipt URL is /receipt/<txHash>?data=..., so there is no
    // invoice id in the path to match against — any non-empty id decodes.
    const payload = decodeReceiptPayload(encodeInvoiceLink(makeInvoice()));
    expect(payload.id).toBe(ID);
  });

  it("rejects bad base64url characters", () => {
    expect(() => decodeReceiptPayload("!!!not-base64!!!")).toThrow(
      /Invalid payment link data/,
    );
  });

  it("rejects non-JSON content", () => {
    expect(() => decodeReceiptPayload(encB64Url("not json"))).toThrow(
      /Invalid payment link data/,
    );
  });

  it("rejects a payload with missing fields", () => {
    expect(() =>
      decodeReceiptPayload(encObj({ id: ID, seller: VALID_SELLER })),
    ).toThrow(/Invalid payment link data/);
  });

  it("rejects an empty id", () => {
    expect(() => decodeReceiptPayload(encObj(validObj({ id: "" })))).toThrow(
      /Invalid payment link data/,
    );
  });

  it("rejects an invalid seller address", () => {
    expect(() =>
      decodeReceiptPayload(encObj(validObj({ seller: "0x123" }))),
    ).toThrow(/Invalid seller address/);
  });

  it("rejects a zero amount", () => {
    expect(() => decodeReceiptPayload(encObj(validObj({ amount: "0" })))).toThrow(
      /Invalid invoice amount/,
    );
  });

  it("rejects a description longer than 140 chars", () => {
    expect(() =>
      decodeReceiptPayload(encObj(validObj({ description: "x".repeat(141) }))),
    ).toThrow(/Invalid invoice description/);
  });
});

describe("generateInvoiceId", () => {
  it("returns a 12-character URL-safe id", () => {
    const id = generateInvoiceId();
    expect(id).toHaveLength(12);
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateInvoiceId()));
    expect(ids.size).toBe(100);
  });
});

describe("createInvoice", () => {
  const NOW = new Date("2026-12-01T10:00:00.000Z");

  it("builds an unpaid invoice with generated id and timestamp", () => {
    const invoice = createInvoice(
      {
        seller: VALID_SELLER,
        amount: "2500000",
        description: "Design work",
        dueDate: "2026-12-15",
      },
      NOW,
    );
    expect(invoice.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(invoice.seller).toBe(VALID_SELLER);
    expect(invoice.amount).toBe("2500000");
    expect(invoice.description).toBe("Design work");
    expect(invoice.dueDate).toBe("2026-12-15");
    expect(invoice.createdAt).toBe("2026-12-01T10:00:00.000Z");
    expect(invoice.status).toBe("unpaid");
    expect(invoice.txHash).toBeNull();
  });

  it("accepts a null due date", () => {
    const invoice = createInvoice(
      { seller: VALID_SELLER, amount: "1", description: "x", dueDate: null },
      NOW,
    );
    expect(invoice.dueDate).toBeNull();
  });

  it("trims the description", () => {
    const invoice = createInvoice(
      {
        seller: VALID_SELLER,
        amount: "1",
        description: "  padded  ",
        dueDate: null,
      },
      NOW,
    );
    expect(invoice.description).toBe("padded");
  });

  it("round-trips through the payment link", () => {
    const invoice = createInvoice(
      {
        seller: VALID_SELLER,
        amount: "1500000",
        description: "Test invoice",
        dueDate: null,
      },
      NOW,
    );
    const payload = decodeInvoiceLink(encodeInvoiceLink(invoice), invoice.id);
    expect(payload.id).toBe(invoice.id);
    expect(payload.amount).toBe("1500000");
  });

  it("rejects an invalid seller address", () => {
    expect(() =>
      createInvoice(
        { seller: "not-an-address", amount: "1", description: "x", dueDate: null },
        NOW,
      ),
    ).toThrow(/valid wallet address/);
  });

  it("rejects a zero amount", () => {
    expect(() =>
      createInvoice(
        { seller: VALID_SELLER, amount: "0", description: "x", dueDate: null },
        NOW,
      ),
    ).toThrow(/positive/);
  });

  it("rejects a non-integer amount string", () => {
    expect(() =>
      createInvoice(
        { seller: VALID_SELLER, amount: "1.5", description: "x", dueDate: null },
        NOW,
      ),
    ).toThrow(/positive/);
  });

  it("rejects an empty description", () => {
    expect(() =>
      createInvoice(
        { seller: VALID_SELLER, amount: "1", description: "   ", dueDate: null },
        NOW,
      ),
    ).toThrow(/Description is required/);
  });

  it("rejects a description over 140 characters", () => {
    expect(() =>
      createInvoice(
        {
          seller: VALID_SELLER,
          amount: "1",
          description: "x".repeat(141),
          dueDate: null,
        },
        NOW,
      ),
    ).toThrow(/140 characters/);
  });

  it("rejects an invalid due date", () => {
    expect(() =>
      createInvoice(
        {
          seller: VALID_SELLER,
          amount: "1",
          description: "x",
          dueDate: "not-a-date",
        },
        NOW,
      ),
    ).toThrow(/valid date/);
  });
});

describe("getDisplayStatus", () => {
  const NOW = new Date("2026-12-01T12:00:00.000Z");

  it("keeps a paid invoice paid even past its due date", () => {
    expect(
      getDisplayStatus(
        makeInvoice({ status: "paid", dueDate: "2026-11-01" }),
        NOW,
      ),
    ).toBe("paid");
  });

  it("returns unpaid when there is no due date", () => {
    expect(getDisplayStatus(makeInvoice({ dueDate: null }), NOW)).toBe(
      "unpaid",
    );
  });

  it("returns unpaid for a future due date", () => {
    expect(getDisplayStatus(makeInvoice({ dueDate: "2026-12-15" }), NOW)).toBe(
      "unpaid",
    );
  });

  it("returns unpaid on the due date itself (expires at end of day)", () => {
    expect(getDisplayStatus(makeInvoice({ dueDate: "2026-12-01" }), NOW)).toBe(
      "unpaid",
    );
  });

  it("returns expired for a past due date", () => {
    expect(getDisplayStatus(makeInvoice({ dueDate: "2026-11-30" }), NOW)).toBe(
      "expired",
    );
  });

  it("returns expired for a past full ISO timestamp", () => {
    expect(
      getDisplayStatus(
        makeInvoice({ dueDate: "2026-12-01T10:00:00.000Z" }),
        NOW,
      ),
    ).toBe("expired");
  });

  it("returns unpaid for a future full ISO timestamp", () => {
    expect(
      getDisplayStatus(
        makeInvoice({ dueDate: "2026-12-01T14:00:00.000Z" }),
        NOW,
      ),
    ).toBe("unpaid");
  });

  it("keeps a stored expired status", () => {
    expect(
      getDisplayStatus(makeInvoice({ status: "expired", dueDate: null }), NOW),
    ).toBe("expired");
  });
});
