/**
 * USDC money helpers — convert human decimal strings ↔ bigint base units.
 *
 * USDC uses {@link USDC_DECIMALS} (6) decimals. Amounts are kept internally as
 * `bigint` base units and converted to/from human decimal strings only at the
 * UI boundary. No floating-point arithmetic is used anywhere — all parsing
 * and formatting is string manipulation plus `BigInt`, so money is never
 * subject to float rounding error.
 *
 * This module is pure logic: it imports only `USDC_DECIMALS` from `./chain`
 * (a sibling) and never from `src/app` or `src/components`, so it is
 * unit-testable without rendering anything.
 */

import { USDC_DECIMALS } from "./chain";

/**
 * Parse a human USDC decimal string into `bigint` base units.
 *
 * Accepts plain decimals like `"1.5"`, `"0.000001"`, `"100"`. Surrounding
 * whitespace is trimmed before parsing. Throws a descriptive `Error` for
 * empty, negative, non-numeric, malformed, or too-precise inputs, and for
 * zero (which is not a positive amount).
 *
 * @example parseUsdc("1.5") → 1500000n
 * @example parseUsdc("0.000001") → 1n
 * @example parseUsdc("100") → 100000000n
 */
export function parseUsdc(input: string): bigint {
  // Runtime guard: TS keeps callers honest, but defend against untyped use.
  if (typeof input !== "string") {
    throw new Error("amount must be a string");
  }

  const trimmed = input.trim();

  if (trimmed === "") {
    throw new Error("amount must be a valid decimal number");
  }

  // Reject negatives before the regex (which forbids a leading "-").
  if (trimmed.startsWith("-")) {
    throw new Error("amount must be positive");
  }

  // A plain decimal: digits with an optional single fractional part.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("amount must be a valid decimal number");
  }

  const [intPart, fracPart = ""] = trimmed.split(".");

  if (fracPart.length > USDC_DECIMALS) {
    throw new Error(`amount has too many decimals (max ${USDC_DECIMALS})`);
  }

  // Right-pad the fractional part to full base-unit width, then concatenate
  // with the integer part and parse as a single integer string.
  const paddedFrac = fracPart.padEnd(USDC_DECIMALS, "0");
  const value = BigInt(intPart + paddedFrac);

  if (value === 0n) {
    throw new Error("amount must be positive");
  }

  return value;
}

/**
 * Format `bigint` base units as a human USDC decimal string, dropping any
 * unnecessary trailing zeros.
 *
 * @example formatUsdc(1500000n) → "1.5"
 * @example formatUsdc(1n) → "0.000001"
 * @example formatUsdc(0n) → "0"
 * @example formatUsdc(100000000n) → "100"
 */
export function formatUsdc(baseUnits: bigint): string {
  // Runtime guard: defend against untyped use.
  if (typeof baseUnits !== "bigint") {
    throw new Error("base units must be a bigint");
  }

  if (baseUnits < 0n) {
    throw new Error("base units must not be negative");
  }

  if (baseUnits === 0n) {
    return "0";
  }

  const s = baseUnits.toString();
  // Pad so there is always at least one integer digit (e.g. "1" → "0000001").
  const padded = s.padStart(USDC_DECIMALS + 1, "0");
  const intPart = padded.slice(0, padded.length - USDC_DECIMALS);
  const fracPart = padded.slice(padded.length - USDC_DECIMALS);
  const trimmedFrac = fracPart.replace(/0+$/, "");

  return trimmedFrac.length === 0 ? intPart : `${intPart}.${trimmedFrac}`;
}
