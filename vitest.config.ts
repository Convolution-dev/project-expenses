import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // convex-test must be inlined so its server bundle runs under vitest.
    server: { deps: { inline: ["convex-test"] } },
  },
});
