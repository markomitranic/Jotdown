import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "@jotdown/core/env";
import type { ProjectConfig } from "./config";

/**
 * One project, with its content in a folder on this machine.
 *
 * In the studio the folder is a copy of one commit; in a publication it is the
 * project itself. `base` is where its pages are served: `/owner/repo` in the
 * studio, and the site root, an empty string, in a publication. `assetBase` is
 * where its files are fetched from when that differs: a site hosted under a
 * subpath leaves the page links to the router, which adds the subpath itself,
 * but writes it into every file address. `uploads`, when a host keeps them by
 * content, names where each upload is served for good, by its path in the
 * content folder.
 */
export type Project = {
  id: string;
  base: string;
  assetBase?: string;
  directory: string;
  config: ProjectConfig;
  uploads?: Record<string, string>;
};

/** The scratch space for copied commits, compiled pages and generated API pages. */
export function dataDirectory() {
  return env.DOCS_DATA_DIR ?? join(tmpdir(), "docs-studio");
}
