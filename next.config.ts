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
  // Hide the bottom-left Dev Tools "Rendering" badge (dev-only; spinner/progress stay).
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Next's webpack resolve reads this (not a custom webpack() mutate alone).
  // Required so TypeScript ESM `import "./foo.js"` resolves to `foo.ts`.
  // Turbopack does not honor this in Next 16.4 — keep `next dev --webpack`.
  experimental: {
    extensionAlias,
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
