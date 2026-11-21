/**
 * Address display helpers for KiroPay.
 *
 * Pure functions — no wallet or chain access — so they are unit-testable
 * without rendering anything. Imported by `WalletButton` (connected
 * address display) and the buyer page (seller address display).
 */

/**
 * Shorten an EVM address for display: `0x1234567890…` becomes
 * `0x1234…7890`. Addresses of 10 characters or fewer are returned
 * unchanged (there is nothing meaningful to shorten).
 */
export function shortenAddress(address: `0x${string}`): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
