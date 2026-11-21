import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FAUCET_URL } from "@/lib/chain";
import { StitchedDivider, TestnetBanner } from "../TestnetBanner";

/**
 * Tests for the testnet banner + stitched-divider motif (task 16, Req 9).
 * Rendered to static HTML (no DOM needed) and asserted on the markup: the
 * banner must name Base Sepolia, say test USDC only / no real money, and
 * link the Circle faucet; the divider must render its stitch marks.
 */
describe("TestnetBanner", () => {
  it("names Base Sepolia and says test USDC only, no real money", () => {
    const html = renderToStaticMarkup(<TestnetBanner />);
    expect(html).toContain("Base Sepolia");
    expect(html).toContain("test USDC only");
    expect(html).toContain("no real money");
  });

  it("is labelled TESTNET", () => {
    const html = renderToStaticMarkup(<TestnetBanner />);
    expect(html).toContain("TESTNET");
  });

  it("links to the Circle faucet in a new tab", () => {
    const html = renderToStaticMarkup(<TestnetBanner />);
    expect(html).toContain(`href="${FAUCET_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("includes the stitched divider motif", () => {
    const html = renderToStaticMarkup(<TestnetBanner />);
    expect(html).toContain("border-dashed");
    expect(html).toContain("×");
  });
});

describe("StitchedDivider", () => {
  it("renders a dashed seam with stitch marks, hidden from screen readers", () => {
    const html = renderToStaticMarkup(<StitchedDivider />);
    expect(html).toContain("border-dashed");
    expect(html).toContain("×");
    expect(html).toContain('aria-hidden="true"');
  });
});
