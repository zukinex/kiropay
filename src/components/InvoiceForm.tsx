"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";

import { parseUsdc } from "@/lib/money";
import {
  createInvoice,
  encodeInvoiceLink,
  type Invoice,
} from "@/lib/invoice";
import { saveInvoice } from "@/lib/store";

interface FieldErrors {
  amount?: string;
  description?: string;
  seller?: string;
  dueDate?: string;
}

const inputClass =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-slate-300";
const errorClass = "mt-1 text-sm text-red-400";

/**
 * Seller invoice form (task 8). Amount, description, optional due date, and
 * seller address (prefilled from the connected wallet when available).
 * On submit the invoice is validated, saved to localStorage, and the
 * shareable payment link is shown with a copy button.
 */
export function InvoiceForm({ onCreated }: { onCreated: () => void }) {
  const { address } = useAccount();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [seller, setSeller] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // Payment links need the page origin; read it client-side only.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Prefill the seller address from the connected wallet (only while the
  // field is still empty, so a manual edit is never overwritten).
  useEffect(() => {
    if (address && seller === "") {
      setSeller(address);
    }
  }, [address, seller]);

  function validate(): { ok: true; amountBaseUnits: string } | { ok: false } {
    const next: FieldErrors = {};

    let amountBaseUnits = "";
    if (amount.trim() === "") {
      next.amount = "Enter an amount.";
    } else {
      try {
        amountBaseUnits = parseUsdc(amount).toString();
      } catch (err) {
        if (err instanceof Error && err.message.includes("too many decimals")) {
          next.amount = "USDC has at most 6 decimals.";
        } else if (
          err instanceof Error &&
          err.message.includes("positive")
        ) {
          next.amount = "Amount must be greater than 0.";
        } else {
          next.amount = "Enter a valid amount, e.g. 12.50.";
        }
      }
    }

    if (description.trim() === "") {
      next.description = "Enter a description.";
    } else if (description.trim().length > 140) {
      next.description = "Description must be 140 characters or fewer.";
    }

    if (!isAddress(seller.trim())) {
      next.seller = "Enter a valid wallet address (0x…).";
    }

    if (dueDate !== "" && Number.isNaN(new Date(dueDate).getTime())) {
      next.dueDate = "Enter a valid due date.";
    }

    setErrors(next);
    return Object.keys(next).length === 0
      ? { ok: true, amountBaseUnits }
      : { ok: false };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validate();
    if (!result.ok) {
      setCreated(null);
      return;
    }
    let invoice: Invoice;
    try {
      invoice = createInvoice({
        seller: seller.trim(),
        amount: result.amountBaseUnits,
        description: description.trim(),
        dueDate: dueDate === "" ? null : dueDate,
      });
    } catch (err) {
      // createInvoice re-validates; surface its message on the amount field
      // as a catch-all (field validation above should have caught it first).
      setErrors({
        amount:
          err instanceof Error
            ? err.message
            : "Could not create the invoice.",
      });
      return;
    }
    saveInvoice(invoice);
    setCreated(invoice);
    setCopied(false);
    setAmount("");
    setDescription("");
    setDueDate("");
    onCreated();
  }

  function paymentLink(invoice: Invoice): string {
    return `${origin}/pay/${invoice.id}?data=${encodeInvoiceLink(invoice)}`;
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(paymentLink(created));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (non-secure context) — the link stays visible
      // and selectable below, so the seller can still copy it manually.
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-xl font-semibold">Create an invoice</h2>
      <p className="mt-1 text-sm text-slate-400">
        Bill a customer in USDC. The payment link works without an account —
        the buyer just opens it and pays from their wallet.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div>
          <label htmlFor="kiropay-amount" className={labelClass}>
            Amount (USDC)
          </label>
          <input
            id="kiropay-amount"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 12.50"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? "kiropay-amount-error" : undefined}
          />
          {errors.amount && (
            <p id="kiropay-amount-error" className={errorClass}>
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kiropay-description" className={labelClass}>
            Description
          </label>
          <input
            id="kiropay-description"
            type="text"
            maxLength={140}
            placeholder="e.g. Logo design — November"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "kiropay-description-error" : undefined
            }
          />
          {errors.description && (
            <p id="kiropay-description-error" className={errorClass}>
              {errors.description}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kiropay-due-date" className={labelClass}>
            Due date (optional)
          </label>
          <input
            id="kiropay-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.dueDate)}
            aria-describedby={
              errors.dueDate ? "kiropay-due-date-error" : undefined
            }
          />
          {errors.dueDate && (
            <p id="kiropay-due-date-error" className={errorClass}>
              {errors.dueDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kiropay-seller" className={labelClass}>
            Your wallet address
          </label>
          <input
            id="kiropay-seller"
            type="text"
            placeholder="0x…"
            value={seller}
            onChange={(event) => setSeller(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.seller)}
            aria-describedby={
              errors.seller ? "kiropay-seller-error" : undefined
            }
          />
          {address ? (
            <p className="mt-1 text-sm text-slate-500">
              Prefilled from your connected wallet.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Connect your wallet to prefill this, or paste an address.
            </p>
          )}
          {errors.seller && (
            <p id="kiropay-seller-error" className={errorClass}>
              {errors.seller}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Create invoice
        </button>
      </form>

      {created && origin !== "" && (
        <div className="mt-5 rounded border border-emerald-800 bg-emerald-950/50 p-4">
          <p className="font-medium text-emerald-300">
            Invoice created — share this payment link:
          </p>
          <p className="mt-2 break-all text-sm text-slate-300">
            {paymentLink(created)}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 rounded border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-900"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </section>
  );
}
