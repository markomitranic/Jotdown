import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "editor",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules"],
    server: { deps: { inline: ["@jotdown/core"] } },
  },
});
