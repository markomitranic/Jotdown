import { AsyncLocalStorage } from "node:async_hooks";
import { formatProjectKey, type ProjectKey } from "../../lib/project-key";
import { diskStorage } from "./disk";
import { folderAt, readFolders } from "./disk/folders";
import { readBookmark } from "./disk/projects";
import { githubStorage } from "./github";
import { ProjectUnavailable, type ProjectStorage, type Storage } from "./types";

export { ProjectUnavailable } from "./types";
export type { Bookmark, ProjectListing, ProjectLook, StudioProject } from "./types";

/**
 * Where a project lives, read off its key: a bookmarked folder under `local/`, anything else GitHub.
 *
 * @example await storageOf({ owner: "local", repo: "handbook" }); // the disk storage of ~/Sites/handbook
 * @example await storageOf({ owner: "you", repo: "site" }); // GitHub
 */
async function storageOf(key: ProjectKey): Promise<ProjectStorage> {
  if (key.owner.toLowerCase() !== "local") return githubStorage;

  const folder = await folderAt(formatProjectKey(key));
  if (!folder)
    throw new ProjectUnavailable(`No folder on this machine is bookmarked as ${formatProjectKey(key)}.`, 404);
  return diskStorage(folder);
}

/** The storage the editing request under way chose for its project. */
const pinned = new AsyncLocalStorage<ProjectStorage>();

function editingStorage() {
  const chosen = pinned.getStore();
  if (!chosen) throw new Error("An editing operation ran outside an editing request.");
  return chosen;
}

/**
 * The studio's storage: GitHub projects and bookmarked folders side by side, each read and written its own way.
 *
 * Bookmarks are the folders first, then the saved GitHub projects. Without a
 * GitHub token those are listed as they were saved, unchecked.
 */
export const storage: Storage = {
  openProject: async (key, session) => (await storageOf(key)).openProject(key, session),
  readHead: async (key, session) => (await storageOf(key)).readHead(key, session),
  readUpload: async (key, session, path) => (await storageOf(key)).readUpload(key, session, path),
  readBrand: async (key, session) => (await storageOf(key)).readBrand(key, session),

  listProjects: async (session) => {
    if (!session.token) throw new ProjectUnavailable("Sign in to GitHub to reach your GitHub projects.", 401);
    return githubStorage.listProjects(session);
  },
  readBookmarks: async (session, saved) => {
    const folders = (await readFolders()).map(readBookmark);
    const github = session.token
      ? await githubStorage.readBookmarks(session, saved)
      : saved.map((key) => ({ key: formatProjectKey(key), title: key.repo, icon: null, locked: false }));
    return [...folders, ...github];
  },
  readBlob: async (key, token, sha) =>
    key.owner.toLowerCase() === "local" ? null : githubStorage.readBlob(key, token, sha),

  editing: async (key, session, run) => {
    const chosen = await storageOf(key);
    return pinned.run(chosen, () => chosen.editing(key, session, run));
  },

  uploadsFolder: () => editingStorage().uploadsFolder(),
  readSource: (path) => editingStorage().readSource(path),
  readDocs: () => editingStorage().readDocs(),
  commitTree: (commit) => editingStorage().commitTree(commit),
  commitFile: (save, additions) => editingStorage().commitFile(save, additions),
  commitAsset: (asset) => editingStorage().commitAsset(asset),

  listPageHistory: (path, page, head) => editingStorage().listPageHistory(path, page, head),
  readRevision: (path, sha) => editingStorage().readRevision(path, sha),
};
