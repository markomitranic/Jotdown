import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "publication",
    include: ["{app,server,lib,components}/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname) },
  },
});
