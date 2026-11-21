import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Invoice } from "../invoice";
import {
  STORAGE_KEY,
  listInvoices,
  getInvoice,
  saveInvoice,
  updateInvoice,
  deleteInvoice,
} from "../store";

/**
 * Unit tests for `src/lib/store.ts` (localStorage CRUD for seller invoices).
 *
 * These tests never touch the real `localStorage`. Instead each test gets a
 * fresh in-memory `MemoryStorage` mock assigned to `globalThis.localStorage`
 * in `beforeEach`, then restored to `undefined` in `afterEach`. The store
 * module reads storage only via the `globalThis` guard, so this works in the
 * Node test environment and isolates tests from each other.
 */

const VALID_SELLER = "0x1234567890123456789012345678901234567890" as `0x${string}`;
const DEFAULT_TX = "0xabc123def45678901234567890123456789012345678901234567890abcdef1234" as `0x${string}`;

/** Build a valid Invoice with sensible defaults and optional overrides. */
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "abcdefghij12",
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

/** A minimal in-memory `Storage` implementation — not the real localStorage. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    const keys = Array.from(this.map.keys());
    return index >= 0 && index < keys.length ? keys[index] ?? null : null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let mock: MemoryStorage;

beforeEach(() => {
  mock = new MemoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = mock;
});

afterEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = undefined;
});

describe("store — STORAGE_KEY", () => {
  it('exports the storage key "kiropay:invoices"', () => {
    expect(STORAGE_KEY).toBe("kiropay:invoices");
  });
});

describe("store — listInvoices", () => {
  it("returns [] on empty storage", () => {
    expect(listInvoices()).toEqual([]);
  });
});

describe("store — saveInvoice + getInvoice", () => {
  it("saveInvoice persists an invoice so listInvoices includes it", () => {
    const invoice = makeInvoice();
    saveInvoice(invoice);
    expect(listInvoices()).toContainEqual(invoice);
  });

  it("getInvoice returns the saved invoice by id", () => {
    const invoice = makeInvoice({ id: "abcdefghij12" });
    saveInvoice(invoice);
    expect(getInvoice("abcdefghij12")).toEqual(invoice);
  });

  it("getInvoice returns undefined for a missing id", () => {
    saveInvoice(makeInvoice({ id: "abcdefghij12" }));
    expect(getInvoice("missing")).toBeUndefined();
  });

  it("listInvoices returns invoices newest first (createdAt descending)", () => {
    const older = makeInvoice({ id: "olderinvoice01", createdAt: "2026-12-01T00:00:00.000Z" });
    const newer = makeInvoice({ id: "newerinvoice01", createdAt: "2026-12-02T00:00:00.000Z" });
    saveInvoice(older);
    saveInvoice(newer);
    expect(listInvoices()).toEqual([newer, older]);
  });

  it("saveInvoice with an existing id replaces it (no duplicate, updated fields visible)", () => {
    const original = makeInvoice({ id: "abcdefghij12", description: "Original", amount: "1500000" });
    saveInvoice(original);
    const updated = makeInvoice({ id: "abcdefghij12", description: "Updated", amount: "3000000" });
    saveInvoice(updated);

    expect(listInvoices()).toHaveLength(1);
    const got = getInvoice("abcdefghij12");
    expect(got?.description).toBe("Updated");
    expect(got?.amount).toBe("3000000");
  });
});

describe("store — updateInvoice", () => {
  it("merges a patch into the matching invoice and keeps the id", () => {
    const invoice = makeInvoice({ id: "abcdefghij12", amount: "1500000", description: "Test invoice" });
    saveInvoice(invoice);
    updateInvoice("abcdefghij12", { status: "paid", txHash: DEFAULT_TX });

    const got = getInvoice("abcdefghij12");
    expect(got).toBeDefined();
    expect(got?.status).toBe("paid");
    expect(got?.txHash).toBe(DEFAULT_TX);
    // id is preserved even though the patch type omits it.
    expect(got?.id).toBe("abcdefghij12");
    // untouched fields are preserved.
    expect(got?.amount).toBe("1500000");
    expect(got?.description).toBe("Test invoice");
  });

  it("is a no-op for a missing id", () => {
    updateInvoice("missing", { status: "paid", txHash: DEFAULT_TX });
    expect(listInvoices()).toEqual([]);
  });
});

describe("store — deleteInvoice", () => {
  it("removes the matching invoice", () => {
    const invoice = makeInvoice({ id: "abcdefghij12" });
    saveInvoice(invoice);
    deleteInvoice("abcdefghij12");
    expect(getInvoice("abcdefghij12")).toBeUndefined();
    expect(listInvoices()).toEqual([]);
  });

  it("is a no-op for a missing id", () => {
    const invoice = makeInvoice({ id: "abcdefghij12" });
    saveInvoice(invoice);
    deleteInvoice("missing");
    expect(listInvoices()).toHaveLength(1);
    expect(getInvoice("abcdefghij12")).toEqual(invoice);
  });
});

describe("store — no-storage guard", () => {
  // Override the outer beforeEach: these tests run with storage absent.
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = undefined;
  });

  it("listInvoices returns [] when storage is absent", () => {
    expect(listInvoices()).toEqual([]);
  });

  it("saveInvoice does not throw when storage is absent", () => {
    expect(() => saveInvoice(makeInvoice())).not.toThrow();
  });

  it("getInvoice does not throw and returns undefined when storage is absent", () => {
    expect(() => getInvoice("abcdefghij12")).not.toThrow();
    expect(getInvoice("abcdefghij12")).toBeUndefined();
  });

  it("updateInvoice does not throw when storage is absent", () => {
    expect(() => updateInvoice("abcdefghij12", { status: "paid" })).not.toThrow();
  });

  it("deleteInvoice does not throw when storage is absent", () => {
    expect(() => deleteInvoice("abcdefghij12")).not.toThrow();
  });
});

describe("store — storage isolation", () => {
  it("starts each test with a fresh empty mock (not real localStorage)", () => {
    // Earlier describe blocks saved invoices; a fresh in-memory mock per
    // test means no state leaks across tests.
    expect(listInvoices()).toEqual([]);
  });

  it("persisting then reading round-trips through the mock (sanity)", () => {
    saveInvoice(makeInvoice({ id: "abcdefghij12" }));
    expect(listInvoices()).toHaveLength(1);
    // a second fresh test sees empty storage again
  });
});
