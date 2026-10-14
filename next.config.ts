import type { NextConfig } from "next";
import { securityHeadersForNextConfig } from "./src/server/security/headers.shared.mjs";

// Security headers + CSP (B2-09). Source of truth: headers.shared.mjs
const securityHeaders = securityHeadersForNextConfig();

/** Resolve TypeScript ESM `.js` import specifiers to `.ts` / `.tsx` sources. */
const extensionAlias = {
  ".js": [".ts", ".tsx", ".js"],
  ".mjs": [".mts", ".mjs"],
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ...extensionAlias,
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};

export default nextConfig;
