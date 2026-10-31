import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { CONFIG_FILE, contentDirectory, readProjectConfig } from "@jotdown/core/server/config";

/**
 * A copy of what the site reads to draw a page, kept inside the app so every server function carries it.
 *
 * A page left for its first visit is compiled on the server from the
 * project's config, its pages and its pictures, read for their sizes. The
 * project folder sits outside the app, where a server function's files are
 * never traced from, so the build copies those files into `.content/`, laid
 * out as the repository lays them out, and the built site reads the copy.
 */

const PAGES = [".md", ".mdx", ".json"];
const PICTURES = [".png", ".jpg", ".jpeg", ".webp"];

/**
 * Copies a project's config, pages and pictures into the app's `.content/` folder.
 *
 * @example syncProjectContent("/work/notes", "/work/notes/.jotdown/framework/apps/publication/.content");
 */
export function syncProjectContent(repository: string, into: string) {
  const content = contentDirectory(repository);
  const uploads = join(content, readProjectConfig(repository).uploads);
  const copy = (from: string, kept: string[]) => {
    if (!existsSync(from)) return;
    const filter = (path: string) => statSync(path).isDirectory() || kept.includes(extname(path).toLowerCase());
    cpSync(from, join(into, relative(repository, from)), { recursive: true, filter });
  };

  rmSync(into, { recursive: true, force: true });
  mkdirSync(dirname(join(into, CONFIG_FILE)), { recursive: true });
  if (existsSync(join(repository, CONFIG_FILE))) cpSync(join(repository, CONFIG_FILE), join(into, CONFIG_FILE));
  copy(join(content, "docs"), PAGES);
  copy(uploads, PICTURES);
}
