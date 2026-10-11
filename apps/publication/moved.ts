import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readMoves } from "@jotdown/core/lib/moved";
import { DOCS_ROOT, docUrl, finalHome, inUnderscoreFolder } from "@jotdown/core/lib/paths";
import { contentDirectory } from "@jotdown/core/server/config";

/**
 * Every address `docs/moved.json` records, as route segments, with the address its page lives at now.
 *
 * An address a page lives at again is left out, and so is a page that moved
 * back to where it started, since either would forward to itself.
 *
 * @example movedPages("/work/handbook", "/notes"); // [{ slugs: ["guides", "old"], to: "/notes/guides/new" }]
 */
export function movedPages(repository: string, base: string) {
  const directory = contentDirectory(repository);
  const moves = readMoves(directory);
  const pages = new Set(pageFiles(join(directory, DOCS_ROOT)).map((path) => docUrl(path)));

  return moves.flatMap(({ from }) => {
    const home = finalHome(moves, from);
    const source = docUrl(from);
    if (!home || source === "/" || pages.has(source) || source === docUrl(home)) return [];
    return [{ slugs: source.slice(1).split("/"), to: docUrl(home, base) }];
  });
}

/** Every page file under the docs folder, as `docs/…` paths. */
function pageFiles(root: string) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => `${DOCS_ROOT}/${relative(root, join(entry.parentPath, entry.name)).split(sep).join("/")}`)
    .filter((path) => !inUnderscoreFolder(path));
}
