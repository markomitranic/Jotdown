import { resolve } from "node:path";
import type { NextConfig } from "next";
import { imageConfig } from "../../packages/core/lib/images";
import { UPLOAD_LIMITS } from "@jotdown/editor/limits";
import { env } from "./env";

/** The workspace root, where the lockfile and the shared packages live. */
const workspace = resolve(import.meta.dirname, "../..");

/**
 * `noindex, nofollow` on every response, as a header rather than a meta tag.
 *
 * A meta tag only reaches HTML, and the studio also serves `/llms.mdx/*` and
 * `llms.txt`.
 */
function noIndexHeaders() {
  return [
    {
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ];
}

/**
 * Every host may ask the dev server for its own scripts, fonts and HMR socket.
 *
 * `next dev` answers `/_next/*` only for the host it was started on, so a dev
 * server reached through a tunnel gets its page and is refused every script in
 * it. Next rejects a bare `**`, and `**.*` is any name with a dot in it, which
 * every tunnel host and LAN address is. Production ignores the setting.
 */
const anyDevOrigin = ["**.*"];

/**
 * Packages bundled into the server build instead of loaded from `node_modules`.
 *
 * Next keeps `shiki` external, and Turbopack reaches an external through an
 * alias link it writes into `.next` during the first compile. Bun has already
 * read that folder by then, so on a fresh `.next` every page fails to find the
 * alias until the server restarts. A bundled package needs no alias. The
 * shared core is TypeScript source, so it is compiled with the app.
 */
const bundled = ["shiki", "@jotdown/core", "@jotdown/editor"];

/**
 * A server of only the files it runs on, when the command line builds the studio for one machine.
 *
 * `next build` then traces what the server reads at run time and copies just
 * that into `.next/standalone`, about a tenth of the packages it was built with.
 */
const output = env.STUDIO_STANDALONE ? "standalone" : undefined;

/**
 * The framework files the setup wizard copies into a new project, which no import reaches, so tracing is told of them.
 *
 * Paths are from `apps/studio`, and the files sit at the framework's root.
 */
const setupFiles = { "/api/setup": ["../../.agents/skills/**/*", "../../deployment/**/*", "../../deployment/**/.*"] };

/**
 * Pictures scaled by the studio's own upload routes, not by Next's optimizer.
 *
 * The optimizer keeps its cache inside the build, which in the desktop app is
 * its signed bundle, so the loader asks for a WebP copy beside the original
 * instead, `a.png.w960.webp`, which the routes scale on request.
 */
const images = { ...imageConfig, loader: "custom", loaderFile: "../../packages/core/lib/image-loader.ts" } as const;

const config: NextConfig = {
  output,
  outputFileTracingIncludes: setupFiles,
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: anyDevOrigin,
  transpilePackages: bundled,
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: workspace },
  outputFileTracingRoot: workspace,
  images,
  experimental: { proxyClientMaxBodySize: UPLOAD_LIMITS.max + 1_000_000 },
  headers: async () => noIndexHeaders(),
};

export default config;
