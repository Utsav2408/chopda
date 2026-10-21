import { defineConfig } from "@neon/config/v1";

/**
 * Local / Preview Neon project (Singapore). Production uses a separate US East
 * Neon project whose connection string lives only in Vercel Production env —
 * do not point this CLI config at Production.
 */
export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // Long-lived local/dev branch — no TTL. Ephemeral feature/preview
      // branches auto-expire after a week.
      if (branch.name === "development" || branch.name === "main") {
        return {};
      }
      // Run `neon checkout <name> --create` for short-lived branches
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
