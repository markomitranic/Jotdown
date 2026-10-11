/**
 * Shared contracts for the live editor.
 *
 * Every one of these types crosses a boundary. The server module that publishes
 * the config, the endpoint implementations under `api/`, and the browser bundle
 * all import from this file, so it stays free of Node and DOM specifics and
 * imports nothing but types.
 */

import type { JSONContent } from "@tiptap/core";

/**
 * A doc as the sidebar needs to know it, keyed by the URL it is served at.
 *
 * The page tree the browser is handed carries labels and hrefs and no file
 * paths at all, and every structural change is expressed as a file path. This
 * is the missing half, published by the server so the mapping costs nothing at
 * read time.
 */
export type DocEntry = {
  /** Code owns this page, so browser editing and structural changes are disabled. */
  generated?: boolean;
  /** Repo-relative, `docs/architecture/index.mdx`. */
  source: string;
  title: string;
};

/** What the server hands the browser, once, at the root of the app. */
export type LiveEditGlobalData = {
  /**
   * Route prefix the editing endpoints answer on, naming the project.
   *
   * The page hands this over when it renders, so a save always goes to the
   * project the page came from.
   */
  apiBase: string;
  /** Where the project's pages are served: `/owner/repo` in the studio, an empty string on a site at the root. */
  base: string;
  /**
   * Whether editing, page and sidebar alike, is offered at all.
   *
   * True in the studio for a signed-in editor. False in a local preview and a
   * publication, which have nowhere to commit to.
   */
  editable: boolean;
  /** Whether the project is a folder on this machine, saved to disk rather than committed. */
  local: boolean;
  /** Who is editing, from the GitHub sign-in. Null when nobody is signed in. */
  identity: { name: string; email: string } | null;
  /** Every doc, keyed by permalink, so a sidebar item can name its own file. */
  docs: Record<string, DocEntry>;
  /**
   * Every sidebar link and separator as its `meta.json` spells it, keyed by the folder holding it.
   *
   * The page tree renders their icons into elements and keeps no record of how
   * an entry was typed, so the arranger has nothing to put back: writing a
   * folder's order from the tree alone would respell every one and drop the
   * icons. This is that record, published beside `docs` for the same reason.
   */
  entries: Record<string, string[]>;
  /**
   * The Lucide name every page and folder is drawn with, keyed by repo path.
   *
   * The page tree hands the browser rendered icons and no names, so without
   * this the icon picker on a sidebar row could not say which icon is chosen.
   */
  icons: Record<string, string>;
  /**
   * The commit this render was read from, a sha on GitHub and a fingerprint for a folder.
   *
   * A sidebar change stays drawn as staged until a render reports the commit it made.
   */
  version: string;
};

/** `GET {apiBase}/source?path=docs/foo.mdx` */
export type SourceResponse = {
  path: string;
  /** File contents at branch HEAD, not the copy baked into this build. */
  text: string;
  /** Blob sha, sent back on save so GitHub can reject a stale write. */
  sha: string;
};

/** `POST {apiBase}/save` */
export type SaveRequest = {
  path: string;
  text: string;
  /** The `sha` from the matching `SourceResponse`. */
  sha: string;
  message: string;
  /** Named on the commit as the author. The bot token is the committer. */
  author: { name: string; email: string };
};

export type SaveResponse = {
  /** The commit this save created. Poll the build stamp until it matches. */
  commitSha: string;
  /** New blob sha, so a second save works without reloading the page. */
  sha: string;
};

/**
 * `POST {apiBase}/asset?kind=…&path=docs/foo.md&name=…&email=…`, body is the bytes.
 *
 * The name of the file is a hash of its own contents, so dropping one image into
 * two pages writes it once and a repeated upload costs nothing.
 */
export type AssetResponse = {
  /** Where it landed in the content folder, `docs/_uploads/img/docs/<hash>.png`. */
  path: string;
  /** What the page links to, `/img/docs/<hash>.png` or `/files/docs/<hash>.zip`. */
  url: string;
};

/**
 * One staged change to the page tree.
 *
 * The queue the sidebar builds is a list of these, applied in the order they
 * were made. Paths are repo-relative and final: the browser decides where a new
 * page lands and what a renamed one is called, because it is the half that
 * knows the tree the reader is looking at.
 *
 * Renaming and moving are separate. A rename writes one frontmatter field and
 * holds the URL still; a move changes the address and drags link repair and
 * `docs/moved.json` along behind it. See ADR 0004.
 */
export type StructureOp =
  | {
      kind: "create";
      path: string;
      title: string;
      description: string | null;
      /** A Lucide component name for its front matter, or absent for none. */
      icon?: string | null;
    }
  | {
      kind: "nest";
      /**
       * A page about to hold pages of its own. It becomes the landing page of a
       * folder named after it, at the same address and in the same place.
       */
      path: string;
    }
  | { kind: "rename"; path: string; title: string }
  | {
      kind: "renameSection";
      /** The folder. Its `index.mdx` title and its `meta.json` title both follow. */
      path: string;
      label: string;
    }
  | { kind: "move"; from: string; to: string }
  | {
      kind: "icon";
      /**
       * A file for a page, the folder for a section. A page keeps it in front
       * matter, a section in its `meta.json`.
       */
      path: string;
      /** A Lucide component name, `BookOpen`, or null to take the icon away. */
      icon: string | null;
    }
  | {
      kind: "defaultOpen";
      /** The folder of a section, whose `meta.json` says whether it starts unfolded. */
      path: string;
      open: boolean;
    }
  | {
      kind: "moveSection";
      /** Folders, not files. Everything under `from` comes along. */
      from: string;
      to: string;
    }
  | {
      kind: "delete";
      /** A file. A section is deleted by deleting its `index.mdx`. */
      path: string;
    }
  | {
      kind: "reorder";
      /** The folder whose contents are being put in order. */
      folder: string;
      /**
       * Every name in it, in the order they should appear: basenames for files,
       * and links and separators spelt as the entries they are.
       */
      names: string[];
    };

/**
 * `POST {apiBase}/structure`, applying a whole queue as one commit.
 *
 * Either all of it lands or none of it does. A queue built against a tree that
 * has since changed comes back as a 409, because half a move is worse than no
 * move.
 */
export type StructureRequest = {
  ops: StructureOp[];
  author: { name: string; email: string };
};

/** What the queue did, once it has landed. */
export type StructureResponse = {
  /** Poll the build stamp until it matches, same as a save. */
  commitSha: string;
  /** Paths written and paths removed, for the banner to count. */
  changed: number;
  /** Where each moved page ended up, so the browser can follow one. */
  moves: { from: string; to: string | null }[];
};

/**
 * Error body for any non-2xx from the functions.
 *
 * `conflict` is set only on a 409, where GitHub tells us both shas and the UI
 * can offer to reload rather than silently clobbering a change made elsewhere.
 */
export type ApiError = {
  error: string;
  conflict?: { theirs: string; ours: string };
  /** Set only on a 422 from `structure`, naming which staged change was refused. */
  refusals?: { op: number; reason: string }[];
};

/**
 * Attributes carried by every top-level node in the editor document.
 *
 * They point back into the original file. A node whose serialised form still
 * matches what it was parsed from gets spliced back verbatim from those
 * offsets instead of re-serialised, which is what keeps a one-word edit to a
 * one-line diff. Nodes the user created have all three set to null.
 */
export type BlockOrigin = {
  /** Position among the original top-level blocks, for detecting deletions. */
  srcIndex: number | null;
  srcStart: number | null;
  srcEnd: number | null;
};

/**
 * Why a block is inert.
 *
 * `unknown` is the safety net: any mdast node the bridge has no editable
 * mapping for becomes one of these rather than being dropped, so a save can
 * never lose content the editor didn't understand.
 */
export type InertKind = "esm" | "jsx" | "native" | "expression" | "html" | "unknown";

/** A document parsed and ready to edit. */
export type ParsedDoc = {
  /** The file verbatim. Untouched blocks are spliced out of this on save. */
  source: string;
  /** Raw frontmatter including its `---` fences, or null when there is none. */
  frontmatter: string | null;
  /** Pulled out of the frontmatter so they can be edited as real fields. */
  title: string | null;
  icon: string | null;
  description: string | null;
  doc: JSONContent;
  /**
   * How each original block serialises, keyed by `srcIndex`.
   *
   * Compared against a block's current serialisation to decide splice versus
   * re-serialise. Kept beside the document rather than in node attributes so
   * copying a block around doesn't drag a stale copy of the original with it.
   */
  pristine: Map<number, string>;
};

/** The three front matter fields a page edits, which the printer writes back into the block. */
export type DocFields = {
  title: string | null;
  icon: string | null;
  description: string | null;
};

/**
 * Commits one dropped file and answers with the URL to reach it by.
 *
 * A failure comes back as a message rather than a throw, because the only thing
 * to do with it is show it to whoever dropped the file.
 */
export type Upload = (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

/** A committed version of a page at its current file path. */
export type PageRevision = {
  sha: string;
  subject: string;
  authoredAt: string;
  authors: { name: string; email: string }[];
};

/** A history page pinned to one commit, with current source on the first page. */
export type PageHistoryResponse = {
  head: string;
  revisions: PageRevision[];
  nextPage: number | null;
  current?: SourceResponse;
};

/** Historical Markdown, or a deletion at the requested commit. */
export type PageRevisionResponse = {
  sha: string;
  path: string;
  text: string | null;
};

/**
 * `GET /api/link-preview?url=…`, what a link embed shows, read off the page it points at.
 *
 * A page that could not be read answers with every field empty, which the
 * card draws as its address and host.
 */
export type LinkPreview = {
  title: string;
  description: string;
  site: string;
  image: string;
  favicon: string;
};
