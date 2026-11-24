import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each test file boots its own in-memory Postgres, which takes a moment.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
