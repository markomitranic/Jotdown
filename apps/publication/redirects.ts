import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readMoves } from "@jotdown/core/lib/moved";
import { DOCS_ROOT, docUrl, finalHome, inUnderscoreFolder } from "@jotdown/core/lib/paths";
import { contentDirectory } from "@jotdown/core/server/config";

/**
 * A permanent redirect from every address `docs/moved.json` records to where that page lives now.
 *
 * An address a page lives at again is left alone, since a redirect is
 * answered before any page is.
 *
 * @example movedRedirects("/work/handbook"); // [{ source: "/guides/old", destination: "/guides/new", permanent: true }]
 */
export function movedRedirects(repository: string) {
  const directory = contentDirectory(repository);
  const moves = readMoves(directory);
  const pages = new Set(pageFiles(join(directory, DOCS_ROOT)).map((path) => docUrl(path)));

  return moves.flatMap(({ from }) => {
    const home = finalHome(moves, from);
    const source = docUrl(from);
    if (!home || source === "/" || pages.has(source) || source === docUrl(home)) return [];
    return [{ source, destination: docUrl(home), permanent: true }];
  });
}

/** Every page file under the docs folder, as `docs/…` paths. */
function pageFiles(root: string) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => `${DOCS_ROOT}/${relative(root, join(entry.parentPath, entry.name)).split(sep).join("/")}`)
    .filter((path) => !inUnderscoreFolder(path));
}
