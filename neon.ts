import { defineConfig } from "@neon/config/v1";

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
      if (branch.name === "development") {
        return {};
      }
      // Run `neon checkout <name> --create` for short-lived branches
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
