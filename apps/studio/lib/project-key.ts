/** The request header the proxy names the project in, read off the first two segments of the address. */
export const PROJECT_HEADER = "x-docs-project";

/** The cookie naming the project this browser last had open, as a project key, for the welcome page to offer. */
export const PROJECT_COOKIE = "docs-project";

/** Which repository a project is: an owner and a repository name, as GitHub spells them. */
export type ProjectKey = { owner: string; repo: string };

const NAME = "[A-Za-z0-9][A-Za-z0-9._-]*";
const KEY = new RegExp(`^(${NAME})/(${NAME})$`);

/**
 * Reads a project key as people type or paste it: `owner/repo`, or the repository's GitHub address, web or SSH.
 *
 * @example parseProjectKey("github.com/you/notes"); // { owner: "you", repo: "notes" }
 * @example parseProjectKey("git@github.com:you/notes.git"); // { owner: "you", repo: "notes" }
 * @example parseProjectKey("../etc"); // null
 */
export function parseProjectKey(raw: string): ProjectKey | null {
  const [, owner, repo] = KEY.exec(withoutGitHub(raw)) ?? [];
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * A repository address with GitHub's own parts taken off, leaving what names the repository.
 *
 * @example withoutGitHub("https://www.github.com/you/site.git/"); // "you/site"
 */
export function withoutGitHub(raw: string) {
  return raw
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "");
}

/**
 * Writes a project key back in the form `parseProjectKey` reads.
 *
 * @example formatProjectKey({ owner: "you", repo: "site" }); // "you/site"
 */
export function formatProjectKey({ owner, repo }: ProjectKey) {
  return `${owner}/${repo}`;
}

const STUDIO_SEGMENTS = new Set([
  "api",
  "icons",
  "fonts",
  "studio",
  "uploads",
  "img",
  "files",
  "whiteboards",
  "markdown",
]);
const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/**
 * The project a studio address is under and the address inside it, or null for the studio's own addresses.
 *
 * The studio's own first segments, `api`, `icons` and the like, are never read
 * as an owner, and neither is one with a dot or an underscore, which GitHub
 * does not allow in an account name.
 *
 * @example projectMount("/you/notes/manual"); // { key: "you/notes", rest: "/manual" }
 * @example projectMount("/api/projects"); // null
 */
export function projectMount(pathname: string) {
  const [, owner = "", repo = "", ...rest] = pathname.split("/");
  if (STUDIO_SEGMENTS.has(owner) || !OWNER.test(owner) || !new RegExp(`^${NAME}$`).test(repo)) return null;
  return { key: `${owner}/${repo}`, rest: `/${rest.join("/")}` };
}

/**
 * Where a project's pages are served in the studio, its key as the first two path segments.
 *
 * @example projectBase({ owner: "you", repo: "notes" }); // "/you/notes"
 */
export function projectBase(key: ProjectKey) {
  return `/${formatProjectKey(key)}`;
}

/**
 * The key as one URL path segment. Neither owner nor repository names may hold a `~`.
 *
 * @example projectId("you/site"); // "you~site"
 */
export function projectId(key: string) {
  return key.replaceAll("/", "~");
}

/** Reads a project key back out of its URL segment, or null when it is not one. */
export function parseProjectId(id: string) {
  return parseProjectKey(id.replaceAll("~", "/"));
}
