/**
 * Turning a doc's path into an address, and back.
 *
 * Pure string arithmetic, shared by the server and the browser: a
 * publication writes its redirects out of `docUrl`, the structure endpoint
 * repairs links with `resolve` and `relativeTo`, and the browser turns a
 * typed title into a filename with `slugify`. Keeping one copy is the point,
 * since a disagreement about where `docs/a/index.mdx` is served would show up
 * as a redirect loop rather than as an error.
 */

import { z } from "zod";
import { UNTOUCHABLE } from "./links";

/** Where docs live in every project, and therefore what the sidebar's top level is. */
export const DOCS_ROOT = "docs";

/** Where a project keeps its images, files and whiteboards, unless its config names another folder. */
export const UPLOADS_FOLDER = `${DOCS_ROOT}/_uploads`;

/**
 * One path segment: a letter or digit, then letters, digits, dots, hyphens or underscores.
 *
 * Anchored at a letter or digit, so `..` and dotfiles are unrepresentable
 * rather than merely filtered out. The editor's write allowlist and project
 * keys are both built out of it.
 */
export const PATH_SEGMENT = "[A-Za-z0-9][A-Za-z0-9._-]*";

/**
 * A page's file as the project counts it: a `.md` or `.mdx` under `docs/`, every segment a `PATH_SEGMENT`.
 *
 * @example PAGE_FILE.test("docs/guides/setup.mdx"); // true
 */
export const PAGE_FILE = new RegExp(`^${DOCS_ROOT}/(?:${PATH_SEGMENT}/)*${PATH_SEGMENT}\\.mdx?$`);

/**
 * Whether a path sits in a folder whose name starts with `_`, which holds files rather than pages.
 *
 * The uploads live in one, so a markdown file attached to a page is never read as a page itself.
 *
 * @example inUnderscoreFolder("docs/_uploads/files/docs/notes.md"); // true
 * @example inUnderscoreFolder("docs/guides/setup.mdx"); // false
 */
export function inUnderscoreFolder(path: string) {
  return path
    .split("/")
    .slice(0, -1)
    .some((segment) => segment.startsWith("_"));
}

/**
 * A project path spelt the way the GitHub API counts, from the repository root.
 *
 * A project that is its own repository has no subfolder; one that sits in a
 * monorepo names the folder holding its `docs/`.
 *
 * @example repoPath("docs/a.mdx", ""); // "docs/a.mdx"
 * @example repoPath("docs/a.mdx", "apps/docs"); // "apps/docs/docs/a.mdx"
 */
export function repoPath(path: string, subfolder: string) {
  return subfolder ? `${subfolder}/${path}` : path;
}

/**
 * The file that names a folder and says what order the things inside it go in.
 *
 * One per folder, the docs root included. `title` is the sidebar label,
 * `description` is what the folder's card says, and `pages` is an array of the
 * basenames inside it, so a thing's position is its index. See ADR 0004 for why
 * this is not `sidebar_position`.
 */
export const META_FILE = "meta.json";

/** The page that stands for a folder, rather than sitting as a row inside it. */
export const INDEX_FILE = "index.mdx";

/**
 * The append-only record of every page that changed address.
 *
 * It sits with the content, because it describes the content and the editor
 * rewrites it on every move. The structure endpoint appends to it, and a
 * publication turns it into redirects.
 */
export const MOVED_FILE = `${DOCS_ROOT}/moved.json`;

/**
 * One entry in `moved.json`: where a page went, or that it went nowhere.
 *
 * The record is append-only, so a page moved twice has two entries and is
 * followed hop by hop. `to` is null for a page that was deleted.
 */
export type Move = { from: string; to: string | null };

/** What `moved.json` must hold: every record naming a path a page could have. */
export const movesSchema = z.array(
  z.object({ from: z.string().regex(PAGE_FILE), to: z.string().regex(PAGE_FILE).nullable() }),
);

/** How far a page is followed before a circular record is assumed. */
const MOVE_HOPS = 8;

/**
 * Follows a page through the forwarding record to wherever it finally sits.
 *
 * Null means it was deleted, or was never moved at all, which are the same
 * answer to the only question anyone asks this: is there somewhere else to
 * look. Both the redirect list and a save aimed at a vanished page read it.
 *
 * @example finalHome(moved, "docs/a.md"); // "docs/b/a.md"
 */
export function finalHome(moves: Move[], path: string): string | null {
  let at = path;

  for (let hop = 0; hop < MOVE_HOPS; hop++) {
    const next = moves.find((move) => move.from === at)?.to;
    if (next === undefined || next === null) return at === path ? null : at;
    at = next;
  }

  return null;
}

/**
 * The URL a doc is served at, on a site at the root or under a project's base.
 *
 * The site root is the one page whose address is not derivable, because
 * `docs/index.mdx` claims `/` rather than `/index`. It is spelt out here rather
 * than parsed, since the root page is not something the editor can move anyway.
 *
 * @example docUrl("docs/architecture/index.mdx"); // "/architecture"
 * @example docUrl("docs/tooling/bun.md", "/you/notes"); // "/you/notes/tooling/bun"
 * @example docUrl("docs/index.mdx", "/you/notes"); // "/you/notes"
 */
export function docUrl(path: string, base = "") {
  if (path === `${DOCS_ROOT}/${INDEX_FILE}`) return base || "/";

  const stem = path.slice(`${DOCS_ROOT}/`.length).replace(/\.mdx?$/, "");
  return `${base}/${stem.replace(/\/index$/, "")}`;
}

/**
 * Where a link written in a document actually goes, from the page holding it.
 *
 * A document stores the link an author wrote, `./commit-signing.mdx`, and the
 * build resolves it against the page tree before the reader ever sees it. An
 * editor that has taken a block over has undone that: the block's links read as
 * the file spells them again, which is right for what gets saved and useless to
 * anything that wants to follow one.
 *
 * A site-absolute path, a page or an upload, moves under the project's base.
 * Anything else already addressed, a scheme or a bare fragment, comes back
 * untouched. Everything left is resolved the same way the build resolves it,
 * against the directory the page is written in.
 *
 * @example addressOf("./bun.md", "docs/tooling/index.mdx"); // "/tooling/bun"
 * @example addressOf("/manual", "docs/a.mdx", "/you/notes"); // "/you/notes/manual"
 * @example addressOf("https://x.test", "docs/a.mdx"); // "https://x.test"
 */
export function addressOf(href: string, page: string, base = ""): string {
  if (href.startsWith("/") && !href.startsWith("//")) return base + href;
  if (href === "" || href.startsWith("/") || UNTOUCHABLE.test(href)) return href;

  const [target = "", fragment] = href.split("#");
  const path = resolve(dirOf(page), target);

  return path === null ? href : docUrl(path, base) + (fragment === undefined ? "" : `#${fragment}`);
}

/**
 * A path's basename with its extension taken off, which is how a `meta.json`
 * spells both a page and a folder.
 *
 * @example stemOf("docs/architecture/bff.mdx"); // "bff"
 * @example stemOf("docs/architecture"); // "architecture"
 */
export function stemOf(path: string) {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.mdx?$/, "");
}

/** @example dirOf("docs/a/b.md"); // "docs/a" */
export function dirOf(path: string) {
  const at = path.lastIndexOf("/");
  return at === -1 ? "" : path.slice(0, at);
}

/**
 * Resolves a relative link against the directory it was written in.
 *
 * Returns null when the path climbs past the repo root, which is a link that
 * was already broken before anything moved.
 *
 * @example resolve("docs/a", "../b/c.md"); // "docs/b/c.md"
 */
export function resolve(dir: string, relative: string): string | null {
  const parts = dir ? dir.split("/") : [];

  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") {
      parts.push(segment);
      continue;
    }
    if (parts.length === 0) return null;
    parts.pop();
  }

  return parts.join("/");
}

/**
 * Spells one path as a link from a directory, the way an author would write it.
 *
 * @example relativeTo("docs/a", "docs/a/b.md"); // "./b.md"
 * @example relativeTo("docs/a", "docs/b.md"); // "../b.md"
 */
export function relativeTo(dir: string, path: string) {
  const from = dir ? dir.split("/") : [];
  const to = path.split("/");

  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared++;

  const up = "../".repeat(from.length - shared);
  const down = to.slice(shared).join("/");

  return up ? `${up}${down}` : `./${down}`;
}

/** @example metaPath("docs/architecture"); // "docs/architecture/meta.json" */
export function metaPath(folder: string) {
  return `${folder}/${META_FILE}`;
}

/** @example sectionIndex("docs/architecture"); // "docs/architecture/index.mdx" */
export function sectionIndex(folder: string) {
  return `${folder}/${INDEX_FILE}`;
}

/**
 * Where a page goes once it holds pages of its own: the landing page of a folder named after it.
 *
 * It keeps its extension, and its address, since `/name` serves `name/index` as readily as `name`.
 *
 * @example nestedIndex("docs/guides/setup.md"); // "docs/guides/setup/index.md"
 */
export function nestedIndex(path: string) {
  const extension = path.endsWith(".md") ? ".md" : ".mdx";
  return `${dirOf(path)}/${stemOf(path)}/index${extension}`;
}

/** @example isSectionIndex("docs/architecture/index.mdx"); // true */
export function isSectionIndex(path: string) {
  return /\/index\.mdx?$/.test(path);
}

/**
 * Whether a path names a page or a folder.
 *
 * A section is addressed by its folder and a page by its file, so the two are
 * told apart by the extension rather than by asking the filesystem, which
 * neither the browser nor the pure half of the endpoint can do.
 *
 * @example isDoc("docs/architecture/bff.mdx"); // true
 * @example isDoc("docs/architecture"); // false
 */
export function isDoc(path: string) {
  return /\.mdx?$/.test(path);
}

/**
 * Whether a page compiles as MDX, which decides if JSX in it renders at all.
 *
 * A `.md` page skips JSX parsing, so a `<VideoEmbed />` written into one comes
 * out as the literal characters. Generated references and changelogs are `.md`
 * for exactly that reason, and the editor must not offer them a block it
 * cannot render.
 *
 * @example isMdx("docs/architecture/bff.mdx"); // true
 * @example isMdx("docs/site-internals/changelog.md"); // false
 */
export function isMdx(path: string) {
  return path.endsWith(".mdx");
}

/**
 * How a `meta.json` spells a separator, the label drawn over the pages after it.
 *
 * @example separatorOf("Site internals"); // "---Site internals---"
 * @example separatorOf("Site internals", "Cog"); // "---[Cog]Site internals---"
 */
export function separatorOf(label: string, icon: string | null = null) {
  return `---${icon ? `[${icon}]` : ""}${label}---`;
}

/** Fumadocs' own spelling for a separator, labelled or the bare `---` rule. */
const SEPARATOR_ENTRY = /^---(?:(?:\[([^\]]+)])?(.+)---)?$/;

/**
 * Reads a `---[Icon]Label---` entry back into its parts, or null for anything else.
 *
 * @example separatorIn("---[Cog]Site internals---"); // { label: "Site internals", icon: "Cog" }
 * @example separatorIn("---"); // { label: "", icon: null }
 */
export function separatorIn(entry: string): { label: string; icon: string | null } | null {
  const match = SEPARATOR_ENTRY.exec(entry);
  if (!match) return null;

  return { label: match[2] ?? "", icon: match[1] ?? null };
}

/**
 * A sidebar row pointing at something the page tree does not own.
 *
 * `external` forces a full page load rather than a client-side navigation, and
 * only says anything for a site-relative `url`: Fumadocs already treats a URL
 * carrying a protocol as off-site whether or not the entry says so.
 */
export type SidebarLink = {
  label: string;
  url: string;
  /** A Lucide component name drawn beside the row, or null for none. */
  icon: string | null;
  external: boolean;
};

/** Fumadocs' own spelling for a link, which is the one a `meta.json` is read with. */
const LINK_ENTRY = /^(external:)?(?:\[([^\]]+)])?\[([^\]]+)]\(([^)]+)\)$/;

/**
 * How a `meta.json` spells a sidebar link.
 *
 * @example linkOf({ label: "Next.js", url: "https://nextjs.org", icon: null, external: true })
 */
export function linkOf({ label, url, icon, external }: SidebarLink) {
  const forced = external && !leavesTheSite(url) ? "external:" : "";

  return `${forced}${icon ? `[${icon}]` : ""}[${label}](${url})`;
}

/**
 * Reads a `pages` entry back into the link it spells, or null when it spells something else.
 *
 * @example linkIn("[Rocket][Fumadocs](https://fumadocs.dev)"); // { icon: "Rocket", … }
 * @example linkIn("index"); // null
 */
export function linkIn(entry: string): SidebarLink | null {
  const [, forced, icon, label, url] = LINK_ENTRY.exec(entry) ?? [];
  if (label === undefined || url === undefined) return null;

  return { label, url, icon: icon ?? null, external: Boolean(forced) || leavesTheSite(url) };
}

/**
 * True for a URL that walks out of the site on its own, protocol or protocol-relative.
 *
 * Fumadocs renders such a link as a plain anchor whether or not its entry said
 * `external:`, which is why a link row cannot be recognised by that flag alone.
 *
 * @example leavesTheSite("https://nextjs.org/docs"); // true
 */
export function leavesTheSite(url: string) {
  return /^\w+:/.test(url) || url.startsWith("//");
}

/**
 * Turns a title into the filename it will be committed under.
 *
 * Lowercase and hyphenated, matching the convention every page in `docs/`
 * already follows. `ø` and `æ` are spelled out first because unicode
 * decomposition leaves them alone, and a Danish name in a title would otherwise
 * become a row of hyphens. Empty output falls back to `page`, since a title
 * made entirely of punctuation still has to land somewhere.
 *
 * @example slugify("CI/CD and delivery"); // "ci-cd-and-delivery"
 */
export function slugify(title: string) {
  const slug = title
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "page";
}
