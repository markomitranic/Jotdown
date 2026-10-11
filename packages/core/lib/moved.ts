import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BrokenFile, readJsonFile } from "@jotdown/core/lib/broken-file";
import type { Project } from "@jotdown/core/server/project";
import { MOVED_FILE, docUrl, finalHome, movesSchema, type Move } from "@jotdown/core/lib/paths";

/**
 * The moves a content folder's `docs/moved.json` records, or none when it has no such file.
 *
 * A file that is not JSON, or a record naming a path no page could have, throws
 * a `BrokenFile` rather than being skipped, since a redirect built from it
 * would point somewhere made up.
 *
 * @example readMoves("/work/handbook"); // [{ from: "docs/guides/old.mdx", to: "docs/guides/new.mdx" }]
 */
export function readMoves(directory: string): Move[] {
  const file = join(directory, MOVED_FILE);
  if (!existsSync(file)) return [];

  const moves = readJsonFile(movesSchema, readFileSync(file, "utf8"));
  if (!moves.ok) throw new BrokenFile(MOVED_FILE, moves.problem);
  return moves.data;
}

/**
 * The moves a page is looked up in, or none while `docs/moved.json` is broken, which the project reports on its own.
 *
 * @example knownMoves("/work/handbook"); // [] for a file that is not JSON
 */
export function knownMoves(directory: string): Move[] {
  try {
    return readMoves(directory);
  } catch (error) {
    if (error instanceof BrokenFile) return [];
    throw error;
  }
}

/**
 * Where a page that used to live at this address went, or null when nothing moved from here.
 *
 * @example movedTo(project, "/guides/old"); // "/guides/new"
 */
export function movedTo(project: Project, url: string) {
  const moves = knownMoves(project.directory);
  const from = moves.find((move) => docUrl(move.from) === url)?.from;
  const home = from ? finalHome(moves, from) : null;
  return home && docUrl(home) !== url ? docUrl(home) : null;
}
