import { resolve } from "node:path";
import type { NextConfig } from "next";
import { imageConfig } from "../../packages/core/lib/images";
import { movedRedirects } from "./redirects";
import { contentRepository } from "./repository";
import { syncProjectCode, watchProjectCode } from "./project-code";

/** The Jotdown checkout this app is part of, where the lockfile and the shared packages live. */
const workspace = resolve(import.meta.dirname, "../..");

/** The project this site is built from, and the folder its own components and layouts are copied into. */
const repository = contentRepository(workspace);
const projectCode = resolve(import.meta.dirname, ".project");
syncProjectCode(repository, projectCode);
if (process.env.NODE_ENV === "development") watchProjectCode(repository, projectCode);

/**
 * Packages compiled with the app instead of loaded from `node_modules`.
 *
 * The shared core is TypeScript source. Next keeps `shiki` external, and under
 * Bun a fresh `.next` fails to find the alias Turbopack writes for it until
 * the server restarts; a bundled package needs no alias.
 */
const bundled = ["shiki", "@jotdown/core", "@jotdown/editor"];

/**
 * A Next.js app deployed on Vercel, its pages, uploads, markdown twins and search index written at build time.
 *
 * Vercel serves what the build wrote from its CDN, scales every picture through
 * Next's image optimizer, and answers each address `docs/moved.json` records
 * with a permanent redirect to where its page lives now.
 */
const config: NextConfig = {
  transpilePackages: bundled,
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: workspace, resolveAlias: { "@project": "./.project/index.ts" } },
  outputFileTracingRoot: workspace,
  images: imageConfig,
  redirects: async () => movedRedirects(repository),
};

export default config;
