import { isAddress } from "viem";

/** Invoice status as stored seller-side. */
export type InvoiceStatus = "unpaid" | "paid" | "expired";

/** Full invoice record, stored in the seller's browser (localStorage). */
export interface Invoice {
  id: string;
  seller: `0x${string}`;
  amount: string;        // USDC in 6-decimal base units, as a decimal string (bigint-safe), e.g. "1500000"
  description: string;    // max 140 chars
  dueDate: string | null; // ISO date string, optional (null when absent)
  createdAt: string;     // ISO timestamp
  status: InvoiceStatus;
  txHash: `0x${string}` | null;
}

/** Public invoice data carried in the payment link URL (no status/txHash). */
export interface InvoiceLinkPayload {
  id: string;
  seller: `0x${string}`;
  amount: string;        // base-unit integer string (bigint-safe), e.g. "1500000"
  description: string;
  dueDate: string | null;
  createdAt: string;
}

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const MAX_DESCRIPTION_LENGTH = 140;

function bytesToBase64Url(bytes: Uint8Array): string {
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
  return out; // no padding
}

function base64UrlToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/g, "");
  const lookup: Record<string, number> = {};
  for (let i = 0; i < B64URL.length; i++) {
    lookup[B64URL[i]] = i;
  }
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = lookup[ch];
    if (idx === undefined) {
      throw new Error("invalid base64url");
    }
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function encodeBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

function decodeBase64Url(s: string): string {
  return new TextDecoder().decode(base64UrlToBytes(s));
}

/**
 * Generate a 12-character URL-safe random invoice id (base64url alphabet).
 * Used for the `/pay/<id>` path segment and the link payload's `id`.
 */
export function generateInvoiceId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let id = "";
  for (const byte of bytes) {
    id += B64URL[byte & 0x3f];
  }
  return id;
}

export interface CreateInvoiceInput {
  seller: string;
  /** Amount in USDC base units (6-decimal integer string), e.g. "1500000". */
  amount: string;
  description: string;
  /** ISO date string ("YYYY-MM-DD") or null. */
  dueDate: string | null;
}

/**
 * Build a new unpaid `Invoice` from form input, validating every field.
 * Throws a plain-language `Error` naming the invalid field. The id is
 * generated and `createdAt` defaults to `now` (injectable for tests).
 */
export function createInvoice(
  input: CreateInvoiceInput,
  now: Date = new Date(),
): Invoice {
  const seller = input.seller.trim();
  if (!isAddress(seller)) {
    throw new Error("Seller address is not a valid wallet address.");
  }

  if (!/^\d+$/.test(input.amount) || BigInt(input.amount) <= 0n) {
    throw new Error("Amount must be a positive number.");
  }

  const description = input.description.trim();
  if (description.length === 0) {
    throw new Error("Description is required.");
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    );
  }

  let dueDate: string | null = null;
  if (input.dueDate !== null) {
    const parsed = new Date(input.dueDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Due date is not a valid date.");
    }
    dueDate = input.dueDate;
  }

  return {
    id: generateInvoiceId(),
    seller: seller as `0x${string}`,
    amount: input.amount,
    description,
    dueDate,
    createdAt: now.toISOString(),
    status: "unpaid",
    txHash: null,
  };
}

/**
 * Derive the status shown on the dashboard. A stored `paid` invoice stays
 * paid; an unpaid invoice whose due date has passed (end of that day) shows
 * as `expired`. A date-only due date ("YYYY-MM-DD") expires at the end of
 * that day; a full ISO timestamp expires at that instant. `now` is
 * injectable for tests.
 */
export function getDisplayStatus(
  invoice: Invoice,
  now: Date = new Date(),
): InvoiceStatus {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "expired") return "expired";
  if (invoice.dueDate) {
    const dueEnd = invoice.dueDate.includes("T")
      ? new Date(invoice.dueDate)
      : new Date(`${invoice.dueDate}T23:59:59.999`);
    if (!Number.isNaN(dueEnd.getTime()) && now.getTime() > dueEnd.getTime()) {
      return "expired";
    }
  }
  return "unpaid";
}
export function encodeInvoiceLink(invoice: Invoice): string {
  const payload: InvoiceLinkPayload = {
    id: invoice.id,
    seller: invoice.seller,
    amount: invoice.amount,
    description: invoice.description,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
  };
  return encodeBase64Url(JSON.stringify(payload));
}

/**
 * Validate a parsed link payload's shape and fields (types, seller
 * address, positive amount, description length, dueDate/createdAt types).
 * Does NOT check the payload id against a URL path — callers that have an
 * expected id add that check themselves. Throws a plain-language Error
 * on any failure.
 */
function parseInvoiceLinkPayload(parsed: unknown): InvoiceLinkPayload {
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Invalid payment link data.");
  }

  const obj = parsed as Record<string, unknown>;
  const id = obj.id;
  const seller = obj.seller;
  const amount = obj.amount;
  const description = obj.description;
  const dueDateRaw = obj.dueDate;
  const createdAt = obj.createdAt;

  if (
    typeof id !== "string" ||
    typeof seller !== "string" ||
    typeof amount !== "string" ||
    typeof description !== "string" ||
    typeof createdAt !== "string"
  ) {
    throw new Error("Invalid payment link data.");
  }

  let dueDate: string | null;
  if (dueDateRaw === null) {
    dueDate = null;
  } else if (typeof dueDateRaw === "string") {
    dueDate = dueDateRaw;
  } else {
    throw new Error("Invalid payment link data.");
  }

  if (!isAddress(seller)) {
    throw new Error("Invalid seller address in payment link.");
  }

  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error("Invalid invoice amount in payment link.");
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error("Invalid invoice description in payment link.");
  }

  return {
    id,
    seller: seller as `0x${string}`,
    amount,
    description,
    dueDate,
    createdAt,
  };
}

/**
 * Decode and validate a payment link's base64url `data` payload.
 * Throws a plain-language Error on any malformed input or validation failure.
 * `expectedId` is the id from the URL path (/pay/<id>); the payload id must match.
 */
export function decodeInvoiceLink(data: string, expectedId: string): InvoiceLinkPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(data));
  } catch {
    throw new Error("Invalid payment link data.");
  }

  const payload = parseInvoiceLinkPayload(parsed);

  if (payload.id.length === 0 || payload.id !== expectedId) {
    throw new Error("This payment link does not match the invoice.");
  }

  return payload;
}

/**
 * Decode and validate a receipt link's base64url `data` payload.
 * Same validation as {@link decodeInvoiceLink}, but WITHOUT the id-match
 * check: the receipt URL carries the transaction hash in its path
 * (/receipt/<txHash>), not the invoice id, so there is no expected id to
 * match against. The payload id must still be a non-empty string.
 * Throws a plain-language Error on any malformed input or validation failure.
 */
export function decodeReceiptPayload(data: string): InvoiceLinkPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(data));
  } catch {
    throw new Error("Invalid payment link data.");
  }

  const payload = parseInvoiceLinkPayload(parsed);

  if (payload.id.length === 0) {
    throw new Error("Invalid payment link data.");
  }

  return payload;
}
