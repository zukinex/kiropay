import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StitchedDivider, TestnetBanner } from "@/components/TestnetBanner";

export const metadata: Metadata = {
  title: "KiroPay",
  description:
    "Stablecoin invoices and payment links. Demo on Base Sepolia testnet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TestnetBanner />
        <Providers>{children}</Providers>
        <footer className="mx-auto max-w-2xl px-6 pb-8">
          <StitchedDivider />
          <p className="mt-3 text-center text-xs text-slate-500">
            KiroPay — a Frankenstein build: Web2 invoicing + Web3 payments +
            on-chain verification, stitched together. Demo on Base Sepolia
            testnet.
          </p>
        </footer>
      </body>
    </html>
  );
}
