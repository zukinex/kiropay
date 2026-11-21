/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The wagmi `coinbaseWallet` connector (via the `wagmi/connectors` barrel)
  // pulls in `@base-org/account` -> `@coinbase/cdp-sdk`, which dynamically
  // imports optional `@x402/*` payment-protocol packages that are not
  // installed. They are never used by KiroPay, so alias the whole `@x402`
  // namespace to an empty module so webpack does not try to resolve them.
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), "@x402": false };
    return config;
  },
};

export default nextConfig;
