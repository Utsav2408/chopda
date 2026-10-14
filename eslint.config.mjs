import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "db/migrations/**",
    ],
  },
  {
    // Ban client-component imports of the server DAL. The `server-only` package
    // (imported by src/server/index.ts) is the real build-time guard — it makes
    // Next.js fail the build if a client bundle ever pulls in server code. This
    // rule only blocks the common case directly: an app file importing src/server.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/server"],
              message:
                "Client components should not import src/server directly. Call a server action instead; server-only enforces this at build time too.",
            },
          ],
        },
      ],
    },
  },
  {
    // Route handlers are server-only; they may import the DAL (B3+).
    files: ["src/app/api/**/*.{ts,tsx}", "src/app/**/route.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
