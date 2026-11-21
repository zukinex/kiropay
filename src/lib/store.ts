/**
 * localStorage CRUD for seller invoices.
 *
 * Invoices are persisted in the seller's browser under {@link STORAGE_KEY}.
 * This module is pure logic plus a thin storage adapter: it reaches
 * `localStorage` only via `globalThis` with a runtime guard, so it works in
 * Node (unit tests with a storage mock) and degrades safely when
 * `localStorage` is absent (SSR, restricted environments, or when storage
 * access throws — e.g. some browsers throw in private mode). It never relies
 * on `window`, so it is import-safe from server-rendered modules.
 *
 * This module imports only `type { Invoice }` from `./invoice` (a sibling).
 * It never imports from `src/app` or `src/components`, keeping it unit
 * testable without rendering anything.
 */

import type { Invoice } from "./invoice";

/** localStorage key under which the seller's invoices are persisted. */
export const STORAGE_KEY = "kiropay:invoices";

/**
 * Safely read `localStorage` from `globalThis`. Returns `undefined` when
 * `localStorage` is absent (Node without a polyfill, SSR, restricted
 * environments) or when merely accessing the property throws (some browsers
 * throw on access when storage is disabled).
 */
function getStorage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Read all invoices from storage. Returns a fresh `[]` when storage is
 * absent, the key is missing, or the stored value is corrupt / not a JSON
 * array. The returned array is the parsed copy; callers may mutate it.
 */
function readAll(): Invoice[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }

  if (raw === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
}

/**
 * Write the full invoice list back to storage. No-op when storage is absent
 * or when writing throws (e.g. quota exceeded / private mode). Never throws.
 */
function writeAll(invoices: Invoice[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // Swallow storage errors — a persistence helper must never throw.
  }
}

/**
 * List all seller invoices, newest first (sorted by `createdAt` descending).
 *
 * The on-disk storage order is left untouched: this sorts a COPY so a read
 * never mutates the persisted array. Returns `[]` when storage is absent or
 * empty.
 */
export function listInvoices(): Invoice[] {
  return readAll()
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * Find a single invoice by id. Returns `undefined` when not found or when
 * storage is absent.
 */
export function getInvoice(id: string): Invoice | undefined {
  return readAll().find((invoice) => invoice.id === id);
}

/**
 * Persist an invoice. If an invoice with the same id already exists it is
 * replaced; otherwise the invoice is appended. No-op when storage is absent.
 */
export function saveInvoice(invoice: Invoice): void {
  const all = readAll();
  const index = all.findIndex((existing) => existing.id === invoice.id);
  if (index === -1) {
    all.push(invoice);
  } else {
    all[index] = invoice;
  }
  writeAll(all);
}

/**
 * Merge a partial patch into the invoice with the given id. The id is
 * preserved unchanged. No-op when the id is not found or storage is absent.
 */
export function updateInvoice(id: string, patch: Partial<Omit<Invoice, "id">>): void {
  const all = readAll();
  const index = all.findIndex((existing) => existing.id === id);
  if (index === -1) {
    return;
  }
  all[index] = { ...all[index], ...patch, id: all[index].id };
  writeAll(all);
}

/**
 * Delete the invoice with the given id. No-op when not found or storage is
 * absent.
 */
export function deleteInvoice(id: string): void {
  const all = readAll();
  const next = all.filter((invoice) => invoice.id !== id);
  if (next.length === all.length) {
    return; // nothing removed — skip a needless write
  }
  writeAll(next);
}
