import { join, relative, resolve } from "node:path";
import type { NextConfig } from "next";
import { imageConfig } from "../../packages/core/lib/images";
import { CONFIG_FILE, contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import { movedRedirects } from "./redirects";
import { contentRepository } from "./repository";
import { syncProjectCode, watchProjectCode } from "./project-code";
import { syncProjectUploads, uploadAliases, uploadHeaders, watchProjectUploads } from "./project-uploads";

/** The Jotdown checkout this app is part of, where the lockfile and the shared packages live. */
const workspace = resolve(import.meta.dirname, "../..");

/**
 * The project this site is built from, the folder its own components and layouts are copied into, and the one its uploads are.
 *
 * The uploads are copied once, before the build's workers start, since each of
 * them loads this file too and would empty `public/` while the build reads it.
 */
const repository = contentRepository(workspace);
const projectCode = resolve(import.meta.dirname, ".project");
const projectUploads = resolve(import.meta.dirname, "public");
syncProjectCode(repository, projectCode);
if (!process.env.JOTDOWN_UPLOADS_COPIED) {
  syncProjectUploads(repository, projectUploads);
  process.env.JOTDOWN_UPLOADS_COPIED = "1";
}
if (process.env.NODE_ENV === "development") {
  watchProjectCode(repository, projectCode);
  watchProjectUploads(repository, projectUploads);
}

/**
 * The project's config, pages and pictures, bundled with every server function, which reads them to draw a page on its first visit.
 *
 * Paths are from `apps/publication`. Of the uploads only the pictures come
 * along, for their sizes; every other file is served from `public/`.
 */
const content = relative(import.meta.dirname, contentDirectory(repository));
const uploads = join(content, readProjectConfig(repository).uploads);
const contentFiles = {
  "/*": [
    join(relative(import.meta.dirname, repository), CONFIG_FILE),
    `${content}/docs/**/*.{md,mdx,json}`,
    `${uploads}/**/*.{png,jpg,jpeg,webp}`,
  ],
};

/**
 * Packages compiled with the app instead of loaded from `node_modules`.
 *
 * The shared core is TypeScript source. Next keeps `shiki` external, and under
 * Bun a fresh `.next` fails to find the alias Turbopack writes for it until
 * the server restarts; a bundled package needs no alias.
 */
const bundled = ["shiki", "@jotdown/core", "@jotdown/editor"];

/**
 * A Next.js app deployed on Vercel, its pages, markdown twins and search index each written on its first visit, or at build time when the config sets `prerender`.
 *
 * Vercel serves what the build wrote and the uploads in `public/` from its CDN,
 * scales every picture through Next's image optimizer, and answers each address
 * `docs/moved.json` records with a permanent redirect to where its page lives now.
 *
 * Its scripts are scoped to each deployment, never shared across them as
 * immutable assets. The site is deployed with no framework preset, so Vercel
 * injects its toolbar into the deployment, and it refuses to on immutable files.
 */
const config: NextConfig = {
  supportsImmutableAssets: false,
  transpilePackages: bundled,
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: workspace, resolveAlias: { "@project": "./.project/index.ts" } },
  outputFileTracingRoot: workspace,
  outputFileTracingIncludes: contentFiles,
  images: imageConfig,
  redirects: async () => movedRedirects(repository),
  rewrites: async () => uploadAliases(),
  headers: async () => uploadHeaders(),
};

export default config;
