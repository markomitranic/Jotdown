import { createHash } from "node:crypto";
import { lstat, readdir, readFile, rm, rmdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { CONFIG_FILE } from "@jotdown/core/server/config";

/**
 * Where a project-relative path sits on disk, refusing anything that would leave the folder.
 *
 * Every path reaching here has passed an allowlist already. This is the second
 * line: no `..`, no absolute path, and no symbolic link on the way, so a link
 * committed into a project cannot point a save at a file outside it.
 *
 * @example await inFolder("/work/handbook", "docs/index.mdx"); // "/work/handbook/docs/index.mdx"
 */
export async function inFolder(directory: string, path: string) {
  const parts = path.split("/");
  if (isAbsolute(path) || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
    throw new Error(`${path} is not a path inside the project.`);
  }

  let target = directory;
  for (const part of parts) {
    target = join(target, part);
    const info = await lstat(target).catch(() => null);
    if (info?.isSymbolicLink())
      throw new Error(`${path} runs through a symbolic link, which the studio does not follow.`);
  }
  return target;
}

/**
 * The text of a project file, or null when there is none.
 *
 * @example await readText("/work/handbook", "docs/index.mdx"); // "# Handbook\n…"
 */
export async function readText(directory: string, path: string) {
  try {
    return await readFile(await inFolder(directory, path), "utf8");
  } catch {
    return null;
  }
}

/**
 * Every file under `docs/`, as project-relative paths in a stable order.
 *
 * @example await docsFiles("/work/handbook"); // ["docs/index.mdx", "docs/meta.json", …]
 */
export async function docsFiles(directory: string) {
  const root = join(directory, DOCS_ROOT);
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}

/**
 * A fingerprint of the project's pages and config, which changes whenever one of them is written.
 *
 * It stands in for a commit: an open page polls it and refreshes when it moves,
 * so a page an agent writes shows up without a reload. Sizes and modification
 * times are enough, and cost a `stat` per file instead of a read.
 *
 * @example await fingerprint("/work/handbook", "/work/handbook"); // "3f1c…" (40 hex digits)
 */
export async function fingerprint(folder: string, directory: string) {
  const files = [...(await docsFiles(directory)).map((path) => join(directory, path)), join(folder, CONFIG_FILE)];
  const hash = createHash("sha1");

  for (const file of files) {
    const info = await stat(file).catch(() => null);
    hash.update(`${file}\0${info?.size ?? -1}\0${info?.mtimeMs ?? -1}\n`);
  }
  return hash.digest("hex");
}

/**
 * The sha git would give this text as a blob, so a save's conflict check reads the same as on GitHub.
 *
 * @example blobSha(""); // "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
 */
export function blobSha(text: string) {
  const bytes = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}

/**
 * Deletes a project file and any folders its going leaves empty, stopping at `docs/`.
 *
 * @example await removeFile("/work/handbook", "docs/old/page.mdx"); // also removes docs/old/ when it is now empty
 */
export async function removeFile(directory: string, path: string) {
  await rm(await inFolder(directory, path), { force: true });

  let folder = dirname(path);
  while (folder.startsWith(`${DOCS_ROOT}/`)) {
    const left = await readdir(await inFolder(directory, folder)).catch(() => null);
    if (left === null || left.length > 0) return;

    await rmdir(await inFolder(directory, folder));
    folder = dirname(folder);
  }
}
