import { cpSync, existsSync, mkdirSync, rmSync, watch } from "node:fs";
import { join } from "node:path";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";

/**
 * A project's uploads, brought into the site as its own static files in `public/`.
 *
 * Pages link `/img/…`, `/files/…`, `/whiteboards/…` and `/uploads/…`, each a
 * folder of the project's uploads. They are copied into `public/` under the same
 * addresses, so Vercel serves them from its CDN and Next's image optimizer can
 * scale them, which it only does for a site's own static files. In development
 * the uploads are watched, and a new one is copied over at once.
 */

/** The upload addresses kept in folders of their own inside the uploads folder. */
const ROOTS = ["img", "files", "whiteboards"];

/**
 * Copies a project's uploads into the app's `public/` folder, which the build owns.
 *
 * @example syncProjectUploads("/work/notes", "/work/notes/.jotdown/framework/apps/publication/public");
 */
export function syncProjectUploads(repository: string, into: string) {
  const folder = uploadsOf(repository);
  const kept = new Set(ROOTS.map((root) => join(folder, root)));

  rmSync(into, { recursive: true, force: true });
  mkdirSync(join(into, "uploads"), { recursive: true });
  if (!existsSync(folder)) return;

  cpSync(folder, join(into, "uploads"), { recursive: true, filter: (path) => !kept.has(path) });
  for (const root of ROOTS) {
    if (existsSync(join(folder, root))) cpSync(join(folder, root), join(into, root), { recursive: true });
  }
}

/**
 * Keeps the copy in step with the project's uploads while a dev server runs.
 *
 * @example watchProjectUploads("/work/notes", into);
 */
export function watchProjectUploads(repository: string, into: string) {
  const folder = uploadsOf(repository);
  if (existsSync(folder)) watch(folder, { recursive: true }, () => syncProjectUploads(repository, into));
}

/**
 * Every upload's second address under `/uploads/`, which the studio answers too, sent on to the file itself.
 *
 * @example uploadAliases(); // [{ source: "/uploads/img/:path*", destination: "/img/:path*" }, …]
 */
export function uploadAliases() {
  return ROOTS.map((root) => ({ source: `/uploads/${root}/:path*`, destination: `/${root}/:path*` }));
}

/**
 * The headers every upload is served with, so a file somebody uploaded can never run as a page of the site.
 *
 * @example headers: async () => uploadHeaders();
 */
export function uploadHeaders() {
  return [
    {
      source: `/:root(uploads|${ROOTS.join("|")})/:path*`,
      headers: [
        { key: "content-security-policy", value: "sandbox" },
        { key: "x-content-type-options", value: "nosniff" },
      ],
    },
  ];
}

/** The project's uploads folder on disk. */
function uploadsOf(repository: string) {
  return join(contentDirectory(repository), readProjectConfig(repository).uploads);
}
