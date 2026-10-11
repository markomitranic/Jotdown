import { CONFIG_FILE } from "@jotdown/core/lib/config";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import type { ProjectStorage } from "../types";
import * as editing from "./editing";
import type { Folder } from "./folders";
import * as history from "./history";
import * as projects from "./projects";

/**
 * One bookmarked folder on this machine as a project, read and written in place.
 *
 * Nothing leaves the machine: no GitHub, no commit. A save writes the file, and
 * committing it is left to whoever owns the folder.
 *
 * @example diskStorage({ key: "local/handbook", path: "/work/handbook" }).readSource("docs/index.mdx");
 */
export function diskStorage(folder: Folder): ProjectStorage {
  const directory = contentDirectory(folder.path);

  return {
    openProject: (key) => projects.openProject(folder, directory, key),
    readHead: (key) => projects.readHead(folder, directory, key),
    readUpload: (key, _session, path) => projects.readUpload(folder, directory, key, path),
    readBrand: (key) => projects.readBrand(folder, directory, key),
    editing: (key, _session, run) => projects.editing(folder, key, run),

    uploadsFolder: async () => readProjectConfig(folder.path).uploads,
    readSource: (path) => editing.readSource(directory, path),
    readDocs: () => editing.readDocs(folder.path, directory),
    commitTree: (commit) => editing.commitTree(folder.path, directory, commit),
    commitFile: (save, additions) => editing.commitFile(folder.path, directory, save, additions),
    commitAsset: (asset) => editing.commitAsset(directory, asset),

    listPageHistory: (path, page, head) => history.listPageHistory(directory, path, page, head),
    readRevision: (path, sha) => history.readRevision(directory, path, sha),

    readConfig: () => editing.readSource(folder.path, CONFIG_FILE),
    saveConfig: (save) => editing.commitFile(folder.path, folder.path, { ...save, path: CONFIG_FILE }),
    listConfigHistory: (page, head) => history.listPageHistory(folder.path, CONFIG_FILE, page, head),
    readConfigRevision: (sha) => history.readRevision(folder.path, CONFIG_FILE, sha),
  };
}
