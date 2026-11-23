/**
 * Base Sepolia chain configuration for KiroPay.
 *
 * This module is the authoritative source for all chain constants. It is a
 * pure constants/config module: it imports only from `viem` (third-party) and
 * never from `src/app` or `src/components`, so it can be unit-tested without
 * rendering anything.
 *
 * All values below are final and were verified on-chain:
 *   - Chain: Base Sepolia (chain ID 84532)
 *   - RPC:   https://sepolia.base.org
 *   - USDC:  0x036CbD53842c5426634e7929541eC2318f3dCF7e (6 decimals)
 *   - Explorer: https://sepolia.basescan.org
 *   - Faucet:   https://faucet.circle.com
 */

import { baseSepolia } from "viem/chains";

/** viem chain descriptor for Base Sepolia (id 84532). */
export { baseSepolia as chain };

// --- Base Sepolia chain constants -------------------------------------------------

/** Base Sepolia chain id. */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Public Base Sepolia RPC endpoint. */
export const RPC_URL = "https://sepolia.base.org";

/**
 * Fallback Base Sepolia RPC endpoint (PublicNode).
 *
 * sepolia.base.org rejects `eth_getLogs` ranges wider than 200 blocks, but
 * the dashboard "Check payment" scan always requests 7,200+ blocks, so it
 * can never succeed on the primary RPC alone. PublicNode allows 50,000-block
 * ranges (verified live 2026-11-23). viem's `fallback` transport tries the
 * primary first and switches here on error.
 */
export const FALLBACK_RPC_URL = "https://base-sepolia-rpc.publicnode.com";

/** Block explorer base URL for Base Sepolia. */
export const EXPLORER_URL = "https://sepolia.basescan.org";

/** Circle test USDC faucet (test USDC + test ETH). */
export const FAUCET_URL = "https://faucet.circle.com";

// --- USDC (Circle testnet on Base Sepolia) ---------------------------------------

/**
 * USDC contract address on Base Sepolia.
 *
 * Typed as a viem `Address` (`` `0x${string}` ``) so it can be passed directly
 * into viem calls without a cast. Do NOT relax this to plain `string`.
 */
export const USDC_ADDRESS: `0x${string}` =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/** USDC decimals (6). USDC is always kept as bigint base units internally. */
export const USDC_DECIMALS = 6;

/** USDC token symbol. */
export const USDC_SYMBOL = "USDC";

/** USDC token name. */
export const USDC_NAME = "USDC";

// --- Pure URL helpers (no I/O) ---------------------------------------------------

/** Build an explorer URL for a transaction hash. */
export function explorerTxUrl(txHash: `0x${string}`): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

/** Build an explorer URL for an address. */
export function explorerAddressUrl(address: `0x${string}`): string {
  return `${EXPLORER_URL}/address/${address}`;
}
