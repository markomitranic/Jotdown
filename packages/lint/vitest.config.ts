import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "lint",
    include: ["**/*.test.ts"],
    exclude: ["node_modules"],
  },
});
