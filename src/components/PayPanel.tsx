"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useBalance,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";

import {
  BASE_SEPOLIA_CHAIN_ID,
  explorerTxUrl,
  FAUCET_URL,
  USDC_ADDRESS,
} from "@/lib/chain";
import { formatUsdc } from "@/lib/money";
import { type Invoice, type InvoiceLinkPayload } from "@/lib/invoice";
import { findPaymentTransfer, type PaymentReceipt } from "@/lib/verify";
import { buildReceiptUrl, isUserRejection } from "@/lib/pay";

/**
 * Pay flow state. `idle` is ready to pay; `awaiting-signature` waits for
 * the wallet prompt; `pending` waits for the receipt (≥ 1 confirmation);
 * `verifying` runs the on-chain Transfer match; `failed` shows the reason
 * and offers a retry. A successful verification routes to the receipt page
 * instead of lingering in a terminal state.
 */
type PayPhase =
  | "idle"
  | "awaiting-signature"
  | "pending"
  | "verifying"
  | "failed";

/**
 * Buyer payment panel (tasks 13–14). Sends a single USDC `transfer` of the
 * exact invoice amount to the seller — no approve step (Req 4) — then waits
 * for the receipt and verifies the USDC `Transfer` event matches the invoice
 * (from = buyer, to = seller, value = exact amount) before routing to the
 * receipt page (Req 5).
 *
 * Guards, all plain-language (Req 8): wallet not connected, wrong network
 * (payments only on Base Sepolia), and insufficient USDC balance — the
 * shortfall message includes the Circle faucet link for test USDC. A
 * rejected signature is reported as cancelled and can be retried; a
 * verification mismatch shows the failure reason and can also be retried.
 */
export function PayPanel({ invoice }: { invoice: InvoiceLinkPayload }) {
  const router = useRouter();
  const { address: buyer } = useAccount();
  const chainId = useChainId();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: buyer,
    token: USDC_ADDRESS,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const {
    data: receipt,
    isError: isReceiptError,
  } = useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  const [phase, setPhase] = useState<PayPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const amount = BigInt(invoice.amount);
  const amountHuman = formatUsdc(amount);
  const balanceValue = balance?.value;
  const hasEnough =
    balanceValue !== undefined && balanceValue >= amount;
  const wrongNetwork = buyer !== undefined && chainId !== BASE_SEPOLIA_CHAIN_ID;
  const isBusy =
    phase === "awaiting-signature" ||
    phase === "pending" ||
    phase === "verifying";

  // After the receipt arrives, verify the USDC Transfer event against the
  // invoice (task 14). Match on all three fields → receipt page. Any
  // mismatch or a reverted transaction → failure reason + retry.
  useEffect(() => {
    if (!receipt || phase !== "pending") {
      return;
    }
    setPhase("verifying");
    if (receipt.status === "reverted") {
      setPhase("failed");
      setMessage(
        "The transaction was reverted on-chain, so no USDC was sent. You can try again.",
      );
      return;
    }
    // viem's receipt logs are structurally the receipt this verifier takes;
    // map them explicitly (same adapter shape as the dashboard scanner).
    const receiptForVerify: PaymentReceipt = {
      from: receipt.from,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: [...log.topics] as `0x${string}`[],
        data: log.data,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      })),
    };
    const invoiceForVerify: Invoice = {
      ...invoice,
      status: "unpaid",
      txHash: null,
    };
    // Pass the connected wallet as the expected sender: wallets that relay
    // transactions submit from a relayer address, so `receipt.from` is not
    // the payer — the Transfer event's `from` is.
    const result = findPaymentTransfer(
      receiptForVerify,
      invoiceForVerify,
      buyer,
    );
    if (result.matched) {
      router.push(buildReceiptUrl(result.txHash, invoice));
    } else {
      setPhase("failed");
      setMessage(
        `Payment could not be verified on-chain: ${result.reason} You can try again.`,
      );
    }
  }, [receipt, phase, invoice, router, buyer]);

  // The receipt never arrived (RPC error / timeout) — plain language, and
  // the explorer link below lets the buyer check the hash manually.
  useEffect(() => {
    if (
      isReceiptError &&
      (phase === "pending" || phase === "verifying")
    ) {
      setPhase("failed");
      setMessage(
        "Could not confirm the transaction on-chain. Check the explorer link below and try again.",
      );
    }
  }, [isReceiptError, phase]);

  async function handlePay() {
    if (!buyer || wrongNetwork || !hasEnough || isBusy) {
      return;
    }
    setPhase("awaiting-signature");
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [invoice.seller, amount],
        chainId: BASE_SEPOLIA_CHAIN_ID,
      });
      setTxHash(hash);
      setPhase("pending");
    } catch (err) {
      if (isUserRejection(err)) {
        // Cancelled in the wallet — not an error, just back to idle.
        setPhase("idle");
        setMessage(
          "Payment cancelled — you rejected the signature in your wallet. You can try again.",
        );
      } else {
        setPhase("failed");
        setMessage(
          err instanceof Error
            ? `Payment could not be sent: ${err.message}`
            : "Payment could not be sent. You can try again.",
        );
      }
    }
  }

  function handleRetry() {
    setTxHash(undefined);
    setPhase("idle");
    setMessage(null);
  }

  const payDisabled =
    !buyer ||
    wrongNetwork ||
    isBalanceLoading ||
    !hasEnough ||
    isBusy;

  let disabledHint: string | null = null;
  if (!buyer) {
    disabledHint = "Connect your wallet above to pay.";
  } else if (wrongNetwork) {
    disabledHint = "Switch to Base Sepolia above to pay.";
  } else if (isBalanceLoading) {
    disabledHint = "Checking your USDC balance…";
  } else if (!hasEnough) {
    disabledHint = null; // the shortfall box below explains it instead
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-xl font-semibold">Pay this invoice</h2>

      <p className="mt-2 text-slate-300">
        You will send{" "}
        <span className="font-semibold text-slate-100">
          {amountHuman} USDC
        </span>{" "}
        to the seller in a single transaction — no extra approval step.
      </p>

      {buyer && balanceValue !== undefined && !hasEnough && (
        <div className="mt-3 rounded border border-amber-800 bg-amber-950/50 p-4">
          <p className="text-sm text-amber-300">
            Your balance is {formatUsdc(balanceValue)} USDC, but this invoice
            is {amountHuman} USDC — you need{" "}
            {formatUsdc(amount - balanceValue)} USDC more.
          </p>
          <p className="mt-1 text-sm text-amber-300">
            Get test USDC from the{" "}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-amber-200"
            >
              Circle faucet
            </a>
            , then come back and pay.
          </p>
        </div>
      )}

      {disabledHint && (
        <p className="mt-3 text-sm text-slate-400">{disabledHint}</p>
      )}

      {phase !== "failed" && (
        <button
          type="button"
          onClick={handlePay}
          disabled={payDisabled}
          className="mt-4 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {phase === "awaiting-signature"
            ? "Confirm in your wallet…"
            : phase === "pending" || phase === "verifying"
              ? "Waiting for confirmation…"
              : `Pay ${amountHuman} USDC`}
        </button>
      )}

      {txHash && (
        <p className="mt-3 text-sm">
          Transaction submitted:{" "}
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 underline hover:text-emerald-300"
          >
            View on the explorer
          </a>
        </p>
      )}

      {phase === "pending" && (
        <p className="mt-2 text-sm text-slate-400">
          Waiting for at least 1 confirmation, then verifying the payment
          on-chain…
        </p>
      )}

      {phase === "failed" && (
        <div className="mt-4 rounded border border-red-800 bg-red-950/50 p-4">
          <p className="text-sm text-red-300">{message}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900 disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {phase === "idle" && message && (
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      )}
    </div>
  );
}
