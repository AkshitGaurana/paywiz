import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" throws outside Next.js server components; tests run on the server anyway.
      "server-only": path.resolve(__dirname, "tests/serverOnlyStub.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
