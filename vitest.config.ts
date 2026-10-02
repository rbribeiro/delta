import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Regenerate src/generated/assets.ts before any test runs, so `npx vitest` (which skips
    // npm's `pretest`) never tests a stale runtime or stylesheet. Takes a fraction of a second.
    globalSetup: ["test/setup-assets.ts"],
  },
});
