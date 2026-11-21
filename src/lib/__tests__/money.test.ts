import { describe, it, expect } from "vitest";

import { parseUsdc, formatUsdc } from "../money";

/**
 * Unit tests for `src/lib/money.ts` (USDC parse/format with bigint base units,
 * 6 decimals). No floating point is used; values are compared as bigint.
 *
 * Whitespace policy for parseUsdc: surrounding whitespace is trimmed first,
 * so " 1.5 " parses as 1.5 USDC and " " (whitespace only) is rejected as
 * empty/malformed.
 */
describe("parseUsdc", () => {
  describe("valid inputs", () => {
    it('parses "1.5" → 1500000n', () => {
      expect(parseUsdc("1.5")).toBe(1500000n);
    });

    it('parses "0.000001" → 1n (one base unit / dust)', () => {
      expect(parseUsdc("0.000001")).toBe(1n);
    });

    it('parses "100" → 100000000n', () => {
      expect(parseUsdc("100")).toBe(100000000n);
    });

    it('parses "1" → 1000000n', () => {
      expect(parseUsdc("1")).toBe(1000000n);
    });

    it('parses "0.5" → 500000n', () => {
      expect(parseUsdc("0.5")).toBe(500000n);
    });

    it('parses "123.456789" → 123456789n (full 6 decimals)', () => {
      expect(parseUsdc("123.456789")).toBe(123456789n);
    });

    it('parses "0.0001" → 100n (dust amount)', () => {
      expect(parseUsdc("0.0001")).toBe(100n);
    });

    it('parses "1000000" → 1000000000000n (large amount)', () => {
      expect(parseUsdc("1000000")).toBe(1000000000000n);
    });

    it('trims surrounding whitespace (" 1.5 " → 1500000n)', () => {
      expect(parseUsdc(" 1.5 ")).toBe(1500000n);
    });
  });

  describe("invalid inputs", () => {
    it('rejects "0" as non-positive', () => {
      expect(() => parseUsdc("0")).toThrow(/positive/);
    });

    it('rejects "0.0" as non-positive', () => {
      expect(() => parseUsdc("0.0")).toThrow(/positive/);
    });

    it('rejects "0.000000" as non-positive', () => {
      expect(() => parseUsdc("0.000000")).toThrow(/positive/);
    });

    it('rejects "-1" as non-positive (negative)', () => {
      expect(() => parseUsdc("-1")).toThrow(/positive/);
    });

    it('rejects "abc" (letters / non-numeric)', () => {
      expect(() => parseUsdc("abc")).toThrow();
    });

    it('rejects "" (empty)', () => {
      expect(() => parseUsdc("")).toThrow();
    });

    it('rejects " " (whitespace only) as empty/malformed', () => {
      expect(() => parseUsdc(" ")).toThrow();
    });

    it('rejects "1.0000001" (too many decimals)', () => {
      expect(() => parseUsdc("1.0000001")).toThrow(/too many decimals/);
    });

    it('rejects "1.5.5" (malformed)', () => {
      expect(() => parseUsdc("1.5.5")).toThrow();
    });

    it('rejects "1." (trailing dot, malformed)', () => {
      expect(() => parseUsdc("1.")).toThrow();
    });

    it("rejects a non-string at runtime", () => {
      const notAString = 123 as unknown as string;
      expect(() => parseUsdc(notAString)).toThrow(/string/);
    });
  });
});

describe("formatUsdc", () => {
  describe("valid inputs", () => {
    it('formats 1500000n → "1.5"', () => {
      expect(formatUsdc(1500000n)).toBe("1.5");
    });

    it('formats 1n → "0.000001" (one base unit / dust)', () => {
      expect(formatUsdc(1n)).toBe("0.000001");
    });

    it('formats 0n → "0"', () => {
      expect(formatUsdc(0n)).toBe("0");
    });

    it('formats 100000000n → "100"', () => {
      expect(formatUsdc(100000000n)).toBe("100");
    });

    it('formats 123456789n → "123.456789" (full 6 decimals)', () => {
      expect(formatUsdc(123456789n)).toBe("123.456789");
    });

    it('formats 500000n → "0.5"', () => {
      expect(formatUsdc(500000n)).toBe("0.5");
    });

    it('formats 100n → "0.0001" (dust amount)', () => {
      expect(formatUsdc(100n)).toBe("0.0001");
    });

    it('formats 1000000000000n → "1000000" (large amount)', () => {
      expect(formatUsdc(1000000000000n)).toBe("1000000");
    });
  });

  describe("invalid inputs", () => {
    it("rejects a negative bigint", () => {
      expect(() => formatUsdc(-1n)).toThrow(/negative/);
    });
  });

  describe("roundtrip", () => {
    it('formatUsdc(parseUsdc("1.5")) === "1.5"', () => {
      expect(formatUsdc(parseUsdc("1.5"))).toBe("1.5");
    });

    it("parseUsdc(formatUsdc(123456789n)) === 123456789n", () => {
      expect(parseUsdc(formatUsdc(123456789n))).toBe(123456789n);
    });
  });
});
