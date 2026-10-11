import type { Storage } from "../types";
import * as editing from "./editing";
import * as projects from "./projects";

/**
 * Projects as GitHub repositories, read and committed with the editor's own token.
 *
 * GitHub decides what an editor may see and write, so nothing here checks
 * access: a repository the token cannot reach answers as missing.
 */
export const githubStorage: Storage = {
  openProject: projects.openProject,
  readHead: projects.readHead,
  readUpload: projects.readUpload,
  readBrand: projects.readBrand,
  listProjects: projects.listProjects,
  readBookmarks: projects.readBookmarks,
  readBlob: projects.readBlob,
  editing: projects.editing,

  uploadsFolder: editing.uploadsFolder,
  readSource: editing.readSource,
  readDocs: editing.readDocs,
  commitTree: editing.commitTree,
  commitFile: editing.commitFile,
  commitAsset: editing.commitAsset,

  listPageHistory: editing.listPageHistory,
  readRevision: editing.readRevision,
};
