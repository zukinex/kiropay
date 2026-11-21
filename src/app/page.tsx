"use client";

import { useCallback, useEffect, useState } from "react";

import type { Invoice } from "@/lib/invoice";
import { listInvoices } from "@/lib/store";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoiceRow } from "@/components/InvoiceRow";

/**
 * Seller dashboard (task 9): create-invoice form plus the invoice list,
 * newest first, with status badges, copy-link buttons, and the "Check
 * payment" action (task 10) on each row. Invoices live in localStorage, so
 * the list is loaded client-side after mount (never during render, to avoid
 * a server/client hydration mismatch).
 */
export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const refresh = useCallback(() => {
    setInvoices(listInvoices());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KiroPay
        </h1>
        <p className="mt-2 text-lg text-slate-300">
          Stablecoin invoices and payment links. Demo on Base Sepolia.
        </p>
      </header>

      <div className="mt-8">
        <InvoiceForm onCreated={refresh} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Your invoices</h2>
        {invoices.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-center">
            <p className="text-slate-300">No invoices yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Create your first invoice above and share its payment link.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
