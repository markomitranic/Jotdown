import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { themeStylesheet } from "@jotdown/core/lib/theme";
import { readProjectConfig } from "@jotdown/core/server/config";
import { BrokenFile } from "@jotdown/core/lib/broken-file";
import { uploadFile, uploadType } from "@jotdown/core/server/uploads";
import { formatProjectKey, parseProjectKey, projectBase, projectId, type ProjectKey } from "../../../lib/project-key";
import { ProjectUnavailable, type Bookmark, type ProjectLook, type StudioProject } from "../types";
import { fingerprint, inFolder } from "./files";
import { homeRelative, projectTitle, type Folder } from "./folders";
import { originOwner } from "./origin";

/**
 * One bookmarked folder as a project, read in place.
 *
 * Comments are off: they live in a ref on GitHub, which a folder never reaches.
 *
 * `folder.path` holds `.jotdown/config.json`, and `directory` is the folder its
 * `content` names. A key other than the folder's own is refused.
 */

/**
 * Refuses any project but the folder's own.
 *
 * @example ownKey(folder, { owner: "you", repo: "site" }); // throws a 404
 */
function ownKey(folder: Folder, key: ProjectKey) {
  if (formatProjectKey(key).toLowerCase() !== folder.key.toLowerCase()) {
    throw new ProjectUnavailable(`${formatProjectKey(key)} is not ${homeRelative(folder.path)}.`, 404);
  }
}

/**
 * Opens the folder as a project, rendered straight from its files.
 *
 * @example await openProject(folder, directory, key); // { key: "local/handbook", directory, version: "3f1c…", fileUrl: "" }
 */
export async function openProject(folder: Folder, directory: string, key: ProjectKey): Promise<StudioProject> {
  ownKey(folder, key);
  return {
    id: projectId(folder.key),
    key: folder.key,
    base: projectBase(parseProjectKey(folder.key) ?? key),
    directory,
    config: readProjectConfig(folder.path),
    version: await fingerprint(folder.path, directory),
    fileUrl: "",
    configured: true,
  };
}

/**
 * The fingerprint of the folder's pages, which an open page polls to notice a file changing.
 *
 * @example await readHead(folder, directory, key); // { branch: "local", head: "3f1c…" }
 */
export async function readHead(folder: Folder, directory: string, key: ProjectKey) {
  ownKey(folder, key);
  return { branch: "local", head: await fingerprint(folder.path, directory) };
}

/**
 * One upload of the folder, from its uploads folder, or null when it has none.
 *
 * @example await readUpload(folder, directory, key, "img/docs/a.png"); // Response with the bytes
 */
export async function readUpload(folder: Folder, directory: string, key: ProjectKey, path: string) {
  ownKey(folder, key);

  const file = uploadFile(path, readProjectConfig(folder.path).uploads);
  const bytes = await inFolder(directory, file)
    .then((found) => readFile(found))
    .catch(() => null);
  return bytes && new Response(bytes, { headers: { "content-type": uploadType(file) } });
}

/**
 * The folder's look: its title, its theme as a stylesheet, and the addresses of its logos.
 *
 * @example await readBrand(folder, directory, key); // { branch: "local", head: "3f1c…", title: "Handbook", stylesheet: ":root { … }", logo, theme }
 */
export async function readBrand(folder: Folder, directory: string, key: ProjectKey): Promise<ProjectLook> {
  const { logo, title, theme } = readProjectConfig(folder.path);

  const [src, srcDark] = await Promise.all([
    logo ? uploadAddress(folder, directory, key, logo.src) : null,
    logo?.srcDark ? uploadAddress(folder, directory, key, logo.srcDark) : null,
  ]);
  const stylesheet = themeStylesheet(theme, `/${folder.key}`) || null;

  return {
    branch: "local",
    head: await fingerprint(folder.path, directory),
    title,
    stylesheet,
    logo: logo && src ? { alt: logo.alt, src, srcDark: srcDark ?? src } : null,
    theme,
  };
}

/** Where the studio serves one upload of the folder, or null when the folder does not have it. */
async function uploadAddress(folder: Folder, directory: string, key: ProjectKey, address: string) {
  const response = await readUpload(folder, directory, key, address);
  return response && `/${folder.key}${address}`;
}

/**
 * The folder as a bookmark, with where it is on this machine and the GitHub organisation of its `origin`. A folder that went missing is locked.
 *
 * @example readBookmark(folder); // { key: "local/handbook", title: "Handbook", icon, locked: false, folder: "~/Sites/handbook", owner: "you" }
 */
export function readBookmark(folder: Folder): Bookmark {
  const where = homeRelative(folder.path);
  if (projectTitle(folder.path) === null)
    return { key: folder.key, title: basename(folder.path), icon: null, locked: true, folder: where };

  const config = readableConfig(folder.path);
  if (!config) return { key: folder.key, title: basename(folder.path), icon: null, locked: false, folder: where };

  const owner = originOwner(folder.path);
  const icon = config.favicon ?? config.logo?.src;
  return {
    key: folder.key,
    title: config.title,
    icon: icon ? `/${folder.key}${icon}` : null,
    locked: false,
    folder: where,
    ...(owner && { owner }),
  };
}

/**
 * A folder's config, or null while it is broken, so the folder is still listed and opens on what is wrong.
 *
 * @example readableConfig("/Users/ada/Sites/handbook")?.title; // "Handbook"
 */
function readableConfig(path: string) {
  try {
    return readProjectConfig(path);
  } catch (error) {
    if (error instanceof BrokenFile) return null;
    throw error;
  }
}

/**
 * Runs one editing request, once the key is known to be the folder's.
 *
 * @example await editing(folder, key, () => handler(request)); // the handler's answer
 */
export async function editing<T>(folder: Folder, key: ProjectKey, run: () => Promise<T>) {
  ownKey(folder, key);
  return run();
}
