import { describe, it, expect } from "vitest";
import { shortenAddress } from "../address";

describe("shortenAddress", () => {
  it("shortens a full 42-character address to 6 + … + 4", () => {
    expect(
      shortenAddress("0x1234567890123456789012345678901234567890"),
    ).toBe("0x1234…7890");
  });

  it("keeps the checksum case of the kept characters", () => {
    expect(
      shortenAddress("0xAbCdEf123456789012345678901234567890AbCd"),
    ).toBe("0xAbCd…AbCd");
  });

  it("returns a short address unchanged", () => {
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });

  it("returns a 10-character address unchanged", () => {
    expect(shortenAddress("0x12345678")).toBe("0x12345678");
  });

  it("shortens an 11-character address", () => {
    expect(shortenAddress("0x123456789")).toBe("0x1234…6789");
  });
});
