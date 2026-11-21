"use client";

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { explorerAddressUrl } from "@/lib/chain";
import { formatUsdc } from "@/lib/money";
import { shortenAddress } from "@/lib/address";
import {
  decodeInvoiceLink,
  getDisplayStatus,
  type Invoice,
  type InvoiceLinkPayload,
} from "@/lib/invoice";
import { WalletButton } from "@/components/WalletButton";
import { PayPanel } from "@/components/PayPanel";

type DecodeResult =
  | { ok: true; payload: InvoiceLinkPayload }
  | { ok: false; error: string };

/**
 * Buyer payment page (task 11). Decodes and validates the invoice payload
 * carried in the link's `data` query param (Req 2) and shows the invoice
 * summary, or a plain-language error when the link is malformed, missing
 * its data, or does not match this invoice id. An expired invoice shows an
 * expiry notice instead of a payment form — it can no longer be paid.
 *
 * `useSearchParams` requires a Suspense boundary for prerendering, so the
 * decoding component renders inside one.
 */
function PayPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const data = searchParams.get("data");

  const result: DecodeResult = useMemo(() => {
    if (data === null || data === "") {
      return {
        ok: false,
        error:
          "This payment link is missing its invoice data. Ask the seller to send you the full link.",
      };
    }
    try {
      return { ok: true, payload: decodeInvoiceLink(data, id) };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "This payment link is invalid.",
      };
    }
  }, [data, id]);

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/50 p-5">
        <h2 className="text-xl font-semibold text-red-300">
          This payment link doesn&apos;t work
        </h2>
        <p className="mt-2 text-slate-300">{result.error}</p>
        <p className="mt-2 text-sm text-slate-400">
          Double-check the link with the seller — it may have been copied
          incompletely, or the invoice may have been changed.
        </p>
      </div>
    );
  }

  const payload = result.payload;
  const invoiceForStatus: Invoice = {
    ...payload,
    status: "unpaid",
    txHash: null,
  };
  const status = getDisplayStatus(invoiceForStatus);

  if (status === "expired") {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold">This invoice has expired</h2>
        <p className="mt-2 text-slate-300">
          {payload.description} — {formatUsdc(BigInt(payload.amount))} USDC
          {payload.dueDate ? `, due ${payload.dueDate}` : ""}. It can no
          longer be paid; ask the seller for a new invoice if you still owe
          this.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold">Invoice</h2>
        <p className="mt-2 text-3xl font-bold">
          {formatUsdc(BigInt(payload.amount))} USDC
        </p>
        <p className="mt-2 text-slate-200">{payload.description}</p>
        <dl className="mt-4 space-y-1 text-sm text-slate-400">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Pay to</dt>
            <dd>
              <a
                href={explorerAddressUrl(payload.seller)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-400 underline hover:text-emerald-300"
              >
                {shortenAddress(payload.seller)}
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Due</dt>
            <dd>{payload.dueDate ?? "No due date"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Invoice ID</dt>
            <dd className="font-mono">{payload.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Created</dt>
            <dd>{new Date(payload.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6">
        <WalletButton />
      </div>

      <div className="mt-6">
        <PayPanel invoice={payload} />
      </div>
    </>
  );
}

export default function PayPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KiroPay
        </h1>
        <p className="mt-2 text-lg text-slate-300">
          Pay an invoice in USDC. Demo on Base Sepolia — test USDC only, no
          real money.
        </p>
      </header>

      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-slate-400">Loading the invoice…</p>
          }
        >
          <PayPageContent />
        </Suspense>
      </div>
    </main>
  );
}
