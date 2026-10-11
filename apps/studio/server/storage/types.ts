import type { Project } from "@jotdown/core/server/project";
import type { ProjectConfig } from "@jotdown/core/server/config";
import type { Session } from "../auth/session";
import type { ProjectKey } from "../../lib/project-key";
import type { Corpus } from "../live-edit/_structure";
import type { Result } from "../live-edit/_contract";
import type {
  AssetResponse,
  PageHistoryResponse,
  PageRevisionResponse,
  SaveRequest,
  SaveResponse,
  SourceResponse,
} from "@jotdown/editor/types";

/**
 * Where the studio's projects live and how an edit reaches them.
 *
 * `ProjectStorage` is one project's: a GitHub repository read and committed
 * with the editor's own token, or a folder on this machine read and written in
 * place. `Storage` adds what spans every project, listing them and reading the
 * bookmarks. The hosted studio is GitHub alone; a local studio picks GitHub or
 * a folder for each project by its key.
 *
 * Project reads take the key and the session. Editing operations take neither:
 * they run inside `editing`, which pins the project for the request.
 */
export type Storage = ProjectStorage & {
  /** Every project the editor can reach. */
  listProjects: (session: Session) => Promise<ProjectListing[]>;

  /** The saved projects asked for, as each answers now. */
  readBookmarks: (session: Session, saved: ProjectKey[]) => Promise<Bookmark[]>;

  /** One file of a GitHub repository by its blob sha, or null when the token cannot read it or the project is a folder. */
  readBlob: (key: ProjectKey, token: string, sha: string) => Promise<Response | null>;
};

/** Where one project lives and how an edit reaches it. */
export type ProjectStorage = {
  /** Opens a project with its content in a folder the renderer can read. */
  openProject: (key: ProjectKey, session: Session) => Promise<StudioProject>;

  /** The branch a project is edited on and the version it is at, which an open page polls to notice changes. */
  readHead: (key: ProjectKey, session: Session) => Promise<{ branch: string; head: string }>;

  /** One upload of the project from its uploads folder, or a redirect to its blob address, or null when it has none. */
  readUpload: (key: ProjectKey, session: Session, path: string) => Promise<Response | null>;

  /** A project's look, readable before its pages are: title, theme stylesheet, logos and theme. */
  readBrand: (key: ProjectKey, session: Session) => Promise<ProjectLook>;

  /** Runs one editing request against the project a key names. */
  editing: <T>(key: ProjectKey, session: Session, run: () => Promise<T>) => Promise<T>;

  /** Where the project keeps its uploads, inside its content folder. */
  uploadsFolder: () => Promise<string>;
  readSource: (path: string) => Promise<Result<SourceResponse>>;
  readDocs: () => Promise<Result<Docs>>;
  commitTree: (commit: TreeCommit) => Promise<Result<CommitOutcome>>;
  commitFile: (save: SaveRequest, additions?: Addition[]) => Promise<Result<SaveResponse>>;
  commitAsset: (asset: AssetUpload) => Promise<Result<AssetResponse>>;

  listPageHistory: (path: string, page: number, head?: string) => Promise<Result<PageHistoryResponse>>;
  readRevision: (path: string, sha: string) => Promise<Result<PageRevisionResponse>>;

  /** `.jotdown/config.json` as it is now, read from the repository root rather than the content folder. */
  readConfig: () => Promise<Result<SourceResponse>>;
  /** Writes the config back, unless it changed since `save.sha` was read. */
  saveConfig: (save: Omit<SaveRequest, "path">) => Promise<Result<SaveResponse>>;
  listConfigHistory: (page: number, head?: string) => Promise<Result<PageHistoryResponse>>;
  readConfigRevision: (sha: string) => Promise<Result<PageRevisionResponse>>;
};

/** A project the studio opened, with the version it was read at and where its files can be seen online. */
export type StudioProject = Project & {
  key: string;
  version: string;
  /** Where a page's file is shown online, its repository path appended, or empty when it is nowhere online. */
  fileUrl: string;
  /** Whether the project has a `.jotdown/config.json`, which a repository nobody has set up yet lacks. */
  configured: boolean;
};

/** What the loading screen wears before a project's pages arrive, its logos as addresses the studio serves them at. */
export type ProjectLook = {
  branch: string;
  head: string;
  title: string;
  stylesheet: string | null;
  logo: { alt: string; src: string; srcDark: string } | null;
  theme: ProjectConfig["theme"];
};

/** A project entry for the switcher, with the address its icon is drawn from: its favicon, else its logo. */
export type ProjectListing = { key: string; title: string; description: string; icon: string | null };

/**
 * A bookmarked project as its storage answers for it now.
 *
 * A locked bookmark is one the editor cannot open, listed under its repository name.
 * A folder bookmark says where the folder is on this machine, and the GitHub
 * organisation its git `origin` belongs to, when it has one.
 */
export type Bookmark = {
  key: string;
  title: string;
  icon: string | null;
  locked: boolean;
  folder?: string;
  owner?: string;
  /** Always listed, with no way to take it off. */
  pinned?: boolean;
};

/** Every doc in the project, and the version they were all read at. */
export type Docs = { head: string; corpus: Corpus };

/** A file written by a commit. Prose arrives as a string, an upload as bytes. */
export type Addition = { path: string; content: string | Uint8Array };

/** Everything a single commit changes, and the head it was built on. */
export type TreeCommit = {
  message: string;
  additions?: Addition[];
  deletions?: string[];
  /** Credited in a `Co-authored-by` trailer, since GitHub owns the author. */
  author: { name: string; email: string };
  /** Branch head the caller read. GitHub refuses the commit if it has moved. */
  expectedHead: string;
  /** Path whose new blob sha to read back in the same round trip. */
  blobFor?: string;
};

/** What a commit produced, or the news that the branch moved first. */
export type CommitOutcome = { moved: true } | { moved: false; commitSha: string; blobSha: string | null };

/** An upload whose `path` is already named after its bytes, and the address a page links it by. */
export type AssetUpload = {
  path: string;
  url: string;
  bytes: Uint8Array;
  message: string;
  author: { name: string; email: string };
};

/** A project its storage would not hand over, with the HTTP status the page should answer. */
export class ProjectUnavailable extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
