import { OLD_FOLDER, type ContentState } from "../../lib/setup";

/**
 * What a folder of the repository already holds, and what setting docs up there does with it.
 *
 * Files in the way of the content folder are moved aside into `_old/` inside
 * it, when the answers ask for that. Paths are from the repository root.
 */

/** One file or folder moved by a setup. */
export type Move = { from: string; to: string };

const IGNORED = new Set([".DS_Store", "Thumbs.db"]);

/**
 * What a folder holds that is in the way of setting docs up there.
 *
 * At the repository root only `docs/` is in the way, since a root always holds code.
 *
 * @example classify(["notes.md"], false); // { kind: "occupied", entries: ["notes.md"], count: 1 }
 * @example classify(["src", "package.json"], true); // { kind: "clear" }
 */
export function classify(names: string[], root: boolean): ContentState {
  const inTheWay = inTheWayOf(names, root);
  return inTheWay.length === 0
    ? { kind: "clear" }
    : { kind: "occupied", entries: inTheWay.slice(0, 6), count: inTheWay.length };
}

/**
 * Everything in the content folder's way, moved into `_old/` inside it, or nothing when the answers keep it where it is.
 *
 * @example asideMoves("", ["src", "docs"], true); // [{ from: "docs", to: "_old/docs" }]
 */
export function asideMoves(content: string, names: string[], moveOld: boolean): Move[] {
  if (!moveOld) return [];
  return inTheWayOf(names, content === "").map((name) => ({
    from: under(content, name),
    to: under(content, `${OLD_FOLDER}/${name}`),
  }));
}

/**
 * A path inside a folder of the repository, or at its root when the folder is the root.
 *
 * @example under("apps/docs", "docs/index.mdx"); // "apps/docs/docs/index.mdx"
 * @example under("", "docs"); // "docs"
 */
function under(folder: string, path: string) {
  return folder ? `${folder}/${path}` : path;
}

function inTheWayOf(names: string[], root: boolean) {
  const listed = names.filter((name) => !IGNORED.has(name) && name !== OLD_FOLDER);
  return root ? listed.filter((name) => name === "docs") : listed;
}
