"use client";

import { useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

import { BASE_SEPOLIA_CHAIN_ID, USDC_ADDRESS } from "@/lib/chain";
import { formatUsdc } from "@/lib/money";
import { shortenAddress } from "@/lib/address";

const buttonClass =
  "rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50";
const secondaryButtonClass =
  "rounded border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50";

/**
 * Wallet connection control (task 12). Disconnected: offers the injected
 * wallet and Coinbase Wallet connectors (Req 3) — no extra signup. Connected:
 * shows the shortened address, the Base Sepolia test USDC balance, and a
 * disconnect button. On any other network it shows a warning with a
 * one-click switch to Base Sepolia; the PayPanel refuses to send a payment
 * until the switch happens (Req 8).
 */
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    connectors,
    connect,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address,
    token: USDC_ADDRESS,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const [showConnectors, setShowConnectors] = useState(false);

  const wrongNetwork = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

  if (!isConnected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowConnectors((visible) => !visible)}
          disabled={isConnecting}
          className={buttonClass}
        >
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>

        {showConnectors && (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-400">
              Choose a wallet to connect. Testnet only — your wallet never
              shares its private key.
            </p>
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => connect({ connector })}
                disabled={isConnecting}
                className="block w-full rounded border border-slate-600 px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}

        {connectError && (
          <p className="mt-2 text-sm text-red-400">
            Could not connect your wallet: {connectError.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-800 px-3 py-1.5 font-mono text-sm text-slate-200">
          {address ? shortenAddress(address) : "Connected"}
        </span>
        <span className="text-sm text-slate-300">
          Balance:{" "}
          {isBalanceLoading
            ? "…"
            : balance
              ? `${formatUsdc(balance.value)} USDC`
              : "—"}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className={secondaryButtonClass}
        >
          Disconnect
        </button>
      </div>

      {wrongNetwork && (
        <div className="mt-3 rounded border border-amber-800 bg-amber-950/50 p-4">
          <p className="text-sm text-amber-300">
            You&apos;re connected to the wrong network. KiroPay only pays on
            Base Sepolia (testnet).
          </p>
          <button
            type="button"
            onClick={() =>
              switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID })
            }
            disabled={isSwitching}
            className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {isSwitching ? "Switching…" : "Switch to Base Sepolia"}
          </button>
        </div>
      )}
    </div>
  );
}
