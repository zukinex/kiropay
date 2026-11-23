"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createPublicClient, fallback, http, isHash } from "viem";
import { baseSepolia } from "viem/chains";

import {
  explorerAddressUrl,
  explorerTxUrl,
  FALLBACK_RPC_URL,
  RPC_URL,
} from "@/lib/chain";
import { formatUsdc } from "@/lib/money";
import { shortenAddress } from "@/lib/address";
import {
  decodeReceiptPayload,
  type InvoiceLinkPayload,
} from "@/lib/invoice";
import {
  fetchReceiptChainDetails,
  type ReceiptChainDetails,
} from "@/lib/pay";

/** Read-only Base Sepolia client for the receipt's on-chain details. */
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback([http(RPC_URL), http(FALLBACK_RPC_URL)]),
});

type DecodeResult =
  | { ok: true; txHash: `0x${string}`; payload: InvoiceLinkPayload }
  | { ok: false; error: string };

/**
 * Receipt page (task 15). Renders the receipt from the invoice payload in
 * the link's `data` query param plus the transaction hash in the path
 * (/receipt/<txHash>) — no wallet connection and no server lookup needed
 * (Req 6). The buyer address, block number, and timestamp are read from
 * the public RPC as an enrichment; when the chain cannot be reached the
 * receipt still shows, with a note instead of those rows.
 *
 * `useSearchParams` requires a Suspense boundary for prerendering, so the
 * decoding component renders inside one.
 */
function ReceiptPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const txHashParam = Array.isArray(params.txHash)
    ? params.txHash[0]
    : params.txHash ?? "";
  const data = searchParams.get("data");

  const result: DecodeResult = useMemo(() => {
    if (!isHash(txHashParam)) {
      return {
        ok: false,
        error:
          "This receipt link has an invalid transaction hash. Ask the seller to send you the full link.",
      };
    }
    if (data === null || data === "") {
      return {
        ok: false,
        error:
          "This receipt link is missing its invoice data. Ask the seller to send you the full link.",
      };
    }
    try {
      return {
        ok: true,
        txHash: txHashParam,
        payload: decodeReceiptPayload(data),
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "This receipt link is invalid.",
      };
    }
  }, [data, txHashParam]);

  const [chainDetails, setChainDetails] =
    useState<ReceiptChainDetails | null>(null);
  const [chainState, setChainState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  // Enrich the receipt with the buyer, block number, and timestamp from
  // the chain. The payment was already verified on-chain before the buyer
  // was routed here, so a failed read only hides those rows.
  useEffect(() => {
    if (!result.ok) {
      return;
    }
    let cancelled = false;
    fetchReceiptChainDetails(publicClient, result.txHash)
      .then((details) => {
        if (cancelled) return;
        setChainDetails(details);
        setChainState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setChainState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/50 p-5">
        <h2 className="text-xl font-semibold text-red-300">
          This receipt link doesn&apos;t work
        </h2>
        <p className="mt-2 text-slate-300">{result.error}</p>
        <p className="mt-2 text-sm text-slate-400">
          Double-check the link with the seller — it may have been copied
          incompletely, or the payment may not have gone through.
        </p>
      </div>
    );
  }

  const { payload, txHash } = result;

  return (
    <>
      <section className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5">
        <p className="inline-block rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
          Paid — verified on-chain
        </p>
        <h2 className="mt-4 text-xl font-semibold">Payment received</h2>
        <p className="mt-2 text-3xl font-bold">
          {formatUsdc(BigInt(payload.amount))} USDC
        </p>
        <p className="mt-2 text-slate-200">{payload.description}</p>
        <dl className="mt-4 space-y-1 text-sm text-slate-400">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0">Invoice ID</dt>
            <dd className="font-mono">{payload.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0">Paid to</dt>
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
          {chainState === "ready" && chainDetails !== null && (
            <div className="flex gap-2">
              <dt className="w-28 shrink-0">Paid by</dt>
              <dd>
                <a
                  href={explorerAddressUrl(chainDetails.buyer)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-400 underline hover:text-emerald-300"
                >
                  {shortenAddress(chainDetails.buyer)}
                </a>
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-28 shrink-0">Due</dt>
            <dd>{payload.dueDate ?? "No due date"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0">Created</dt>
            <dd>{new Date(payload.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold">Transaction</h2>
        <p className="mt-2 text-sm">
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="font-mono break-all text-emerald-400 underline hover:text-emerald-300"
          >
            {txHash}
          </a>
        </p>
        {chainState === "loading" && (
          <p className="mt-3 text-sm text-slate-400">
            Loading on-chain details…
          </p>
        )}
        {chainState === "ready" && chainDetails !== null && (
          <dl className="mt-3 space-y-1 text-sm text-slate-400">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0">Block</dt>
              <dd>{chainDetails.blockNumber.toString()}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0">Time</dt>
              <dd>
                {new Date(
                  Number(chainDetails.timestamp) * 1000,
                ).toLocaleString()}
              </dd>
            </div>
          </dl>
        )}
        {chainState === "unavailable" && (
          <p className="mt-3 text-sm text-amber-300">
            On-chain details (buyer, block, time) are temporarily
            unavailable — the payment itself was already verified before
            this receipt was shown. Check the transaction link above.
          </p>
        )}
      </section>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-emerald-400 underline hover:text-emerald-300">
          Back to KiroPay
        </Link>
      </p>
    </>
  );
}

export default function ReceiptPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KiroPay
        </h1>
        <p className="mt-2 text-lg text-slate-300">
          Receipt for a USDC payment. Demo on Base Sepolia — test USDC only,
          no real money.
        </p>
      </header>

      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-slate-400">Loading the receipt…</p>
          }
        >
          <ReceiptPageContent />
        </Suspense>
      </div>
    </main>
  );
}
