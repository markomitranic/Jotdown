import { resolve } from "node:path";
import type { NextConfig } from "next";
import { contentRepository } from "./repository";
import { syncProjectCode, watchProjectCode } from "./project-code";
import { siteBase } from "./server/base";

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
 * A static site in `out/`: every page, upload, markdown twin and search index written as a file.
 *
 * It needs no server, so any static host serves it. Images are served as they
 * are, since nothing is left to resize them. A site hosted below a domain's root
 * is built under that base path.
 */
const config: NextConfig = {
  output: "export",
  transpilePackages: bundled,
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: workspace, resolveAlias: { "@project": "./.project/index.ts" } },
  outputFileTracingRoot: workspace,
  images: { unoptimized: true },
  basePath: siteBase(repository),
};

export default config;
