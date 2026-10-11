import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "studio",
    include: ["{app,src,server,lib,components}/**/*.test.{ts,tsx}"],
    server: { deps: { inline: ["@jotdown/core"] } },
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname) },
  },
});
