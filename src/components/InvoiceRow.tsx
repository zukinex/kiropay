"use client";

import { useEffect, useState } from "react";
import { createPublicClient, fallback, http } from "viem";
import { baseSepolia } from "viem/chains";

import { FALLBACK_RPC_URL, RPC_URL, explorerTxUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/money";
import {
  encodeInvoiceLink,
  getDisplayStatus,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoice";
import { updateInvoice } from "@/lib/store";
import {
  checkInvoicePayment,
  type PaymentScannerClientWithBlock,
} from "@/lib/verify";

/** Read-only public client for re-scanning the chain (dashboard checks). */
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback([http(RPC_URL), http(FALLBACK_RPC_URL)]),
});

/** Adapter: the viem public client shaped as the checker's small interface. */
const scanner: PaymentScannerClientWithBlock = {
  getBlockNumber: () => publicClient.getBlockNumber(),
  getLogs: async (args) => {
    const logs = await publicClient.getLogs(args);
    return logs.map((log) => ({
      address: log.address,
      topics: [...log.topics] as `0x${string}`[],
      data: log.data,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  },
};

const badgeClass: Record<InvoiceStatus, string> = {
  unpaid:
    "rounded-full bg-amber-900/60 px-2.5 py-0.5 text-xs font-medium text-amber-300",
  paid: "rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300",
  expired:
    "rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-300",
};

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "found"; txHash: `0x${string}` }
  | { kind: "not-found" }
  | { kind: "error" };

/**
 * One dashboard invoice row (tasks 9–10): amount, description, due date,
 * status badge, copy-link button with confirmation, and — for unpaid
 * invoices — a "Check payment" action that re-scans the chain via
 * `scanForPayment` and marks the invoice paid when a matching USDC Transfer
 * is found.
 */
export function InvoiceRow({
  invoice,
  onChanged,
}: {
  invoice: Invoice;
  onChanged: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [origin, setOrigin] = useState("");

  // Payment links need the page origin; read it client-side only.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const status = getDisplayStatus(invoice);
  const amount = formatUsdc(BigInt(invoice.amount));

  function paymentLink(): string {
    return `${origin}/pay/${invoice.id}?data=${encodeInvoiceLink(invoice)}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(paymentLink());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link is not shown in the row, so there
      // is nothing else to fall back to; the user can copy from the form.
      setCopied(false);
    }
  }

  async function handleCheckPayment() {
    setCheck({ kind: "checking" });
    try {
      const found = await checkInvoicePayment(scanner, invoice);
      if (found) {
        updateInvoice(invoice.id, { status: "paid", txHash: found.txHash });
        setCheck({ kind: "found", txHash: found.txHash });
        onChanged();
      } else {
        setCheck({ kind: "not-found" });
      }
    } catch {
      // RPC unreachable or another chain error — plain language, and the
      // button stays so the seller can retry (Req 8).
      setCheck({ kind: "error" });
    }
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{invoice.description}</p>
          <p className="mt-0.5 text-sm text-slate-400">
            {amount} USDC
            {invoice.dueDate
              ? ` · due ${invoice.dueDate}`
              : " · no due date"}
            {` · created ${new Date(invoice.createdAt).toLocaleDateString()}`}
          </p>
        </div>
        <span className={badgeClass[status]}>{status}</span>
      </div>

      {status === "paid" && invoice.txHash && (
        <p className="mt-2 text-sm">
          <a
            href={explorerTxUrl(invoice.txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            View payment on the explorer
          </a>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={origin === ""}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>

        {status !== "paid" && (
          <button
            type="button"
            onClick={handleCheckPayment}
            disabled={check.kind === "checking"}
            className="rounded border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-900 disabled:opacity-50"
          >
            {check.kind === "checking" ? "Checking…" : "Check payment"}
          </button>
        )}
      </div>

      {check.kind === "found" && (
        <p className="mt-2 text-sm text-emerald-300">
          Payment found on-chain!{" "}
          <a
            href={explorerTxUrl(check.txHash)}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-emerald-200"
          >
            View transaction
          </a>
        </p>
      )}
      {check.kind === "not-found" && (
        <p className="mt-2 text-sm text-slate-400">
          No payment found on-chain yet. The buyer may not have paid, or the
          payment is still confirming — try again in a moment.
        </p>
      )}
      {check.kind === "error" && (
        <p className="mt-2 text-sm text-red-400">
          Could not reach the network. Check your connection and try again.
        </p>
      )}
    </li>
  );
}
