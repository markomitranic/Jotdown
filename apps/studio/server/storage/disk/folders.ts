import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { CONFIG_FILE, readProjectConfig } from "@jotdown/core/server/config";
import { readFavorites, writeFavorites, type Folder } from "../favorites";

export type { Folder } from "../favorites";

/**
 * Every bookmarked folder, in the order they were added.
 *
 * @example await readFolders(); // [{ key: "local/handbook", path: "/Users/ada/Sites/handbook" }]
 */
export async function readFolders(): Promise<Folder[]> {
  return (await readFavorites()).folders;
}

/**
 * The folder a `local/<name>` key was given to, or null when none was.
 *
 * @example await folderAt("local/handbook"); // { key: "local/handbook", path: "/Users/ada/Sites/handbook" }
 */
export async function folderAt(key: string) {
  const wanted = key.toLowerCase();
  return (await readFolders()).find((folder) => folder.key.toLowerCase() === wanted) ?? null;
}

/**
 * Bookmarks a folder that holds a `.jotdown/config.json`, or hands back its bookmark when it already has one.
 *
 * A folder is named after itself, in the letters a project key allows, with a
 * number after it when another folder has the name already.
 *
 * @example await addFolder("~/Sites/handbook"); // { key: "local/handbook", path: "/Users/ada/Sites/handbook" }
 * @example await addFolder("~/Downloads"); // throws: ~/Downloads has no .jotdown/config.json
 */
export async function addFolder(raw: string): Promise<Folder> {
  const path = expandHome(raw);
  if (!existsSync(join(path, CONFIG_FILE)))
    throw new Error(`${homeRelative(path)} has no .jotdown/config.json, so it is not a Jotdown project.`);

  const folders = await readFolders();
  const known = folders.find((folder) => folder.path === path);
  if (known) return known;

  const taken = new Set(folders.map((folder) => folder.key.toLowerCase()));
  const name = keyName(basename(path));
  let key = `local/${name}`;
  for (let count = 2; taken.has(key.toLowerCase()); count++) key = `local/${name}-${count}`;

  const added = { key, path };
  await writeFolders([...folders, added]);
  return added;
}

/** One folder's listing for the folder browser: where it is, its title when it is a project, its parent as typed, and the folders inside it. */
export type FolderListing = {
  path: string;
  display: string;
  title: string | null;
  parent: string | null;
  entries: { name: string; path: string; title: string | null }[];
};

/**
 * The folders inside one folder, with the title of each that is a Jotdown project, hidden ones left out.
 *
 * @example await browseFolder("~/Sites"); // { path: "/Users/ada/Sites", display: "~/Sites", title: null, parent: "~", entries: [{ name: "handbook", path, title: "Handbook" }, …] }
 */
export async function browseFolder(raw: string): Promise<FolderListing> {
  const path = expandHome(raw || "~");
  const children = await readdir(path, { withFileTypes: true });

  const entries = children
    .filter((child) => child.isDirectory() && !child.name.startsWith("."))
    .map((child) => ({ name: child.name, path: join(path, child.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((entry) => ({ ...entry, title: projectTitle(entry.path) }));

  return {
    path,
    display: homeRelative(path),
    title: projectTitle(path),
    parent: dirname(path) === path ? null : homeRelative(dirname(path)),
    entries,
  };
}

/**
 * A folder's project title, or null when it has no `.jotdown/config.json`.
 *
 * @example projectTitle("/Users/ada/Sites/handbook"); // "Handbook"
 */
export function projectTitle(path: string) {
  if (!existsSync(join(path, CONFIG_FILE))) return null;
  try {
    return readProjectConfig(path).title;
  } catch {
    return basename(path);
  }
}

/**
 * A path written the way people type it, `~` and all, made absolute.
 *
 * @example expandHome("~/Sites"); // "/Users/ada/Sites"
 */
export function expandHome(path: string) {
  return resolve(path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path);
}

/**
 * A path as people read it, with the home folder written `~`.
 *
 * @example homeRelative("/Users/ada/Sites/handbook"); // "~/Sites/handbook"
 */
export function homeRelative(path: string) {
  const home = homedir();
  return path === home ? "~" : path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/**
 * A folder name in the letters a project key allows.
 *
 * @example keyName("Client Docs"); // "Client-Docs"
 */
function keyName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "") || "docs";
}

async function writeFolders(folders: Folder[]) {
  await writeFavorites({ ...(await readFavorites()), folders });
}
