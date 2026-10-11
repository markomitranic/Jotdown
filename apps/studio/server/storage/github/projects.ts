import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { unstable_cache } from "next/cache";
import { inUnderscoreFolder, UPLOADS_FOLDER } from "@jotdown/core/lib/paths";
import { themeStylesheet } from "@jotdown/core/lib/theme";
import { CONFIG_FILE, parseProjectConfig } from "@jotdown/core/server/config";
import { formatProjectKey, projectBase, projectId, type ProjectKey } from "../../../lib/project-key";
import { dataDirectory } from "@jotdown/core/server/project";
import { uploadFile, uploadType } from "@jotdown/core/server/uploads";
import type { Session } from "../../auth/session";
import { ProjectUnavailable, type Bookmark, type ProjectListing, type ProjectLook, type StudioProject } from "../types";
import { editingContext } from "./context";
import { fetchRemembered } from "./remembered";

/**
 * Reading projects out of GitHub with the signed-in editor's own token.
 *
 * GitHub decides what the editor may see, so nothing here checks access: a
 * repository the token cannot reach answers as missing, and that is the error
 * the editor gets.
 */

const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;
const BLOBS_PER_QUERY = 100;
const CACHED_PART_BYTES = 1_000_000;

/** Where a GitHub project is edited: the repository, the folder its config names as holding `docs/`, and the branch. */
export type Target = ProjectKey & { subfolder: string; uploads: string; branch: string };

/** A target plus the commit on screen. */
export type Remote = Target & { head: string };

/** Texts already fetched, keyed by blob sha, so a new commit only downloads what changed. */
const blobs = new Map<string, string>();

/** Targets settled in the last five minutes, so the polls of an open page do not ask GitHub for the config each time. */
const targets = new Map<string, { target: Target; at: number }>();
const TARGET_TTL_MS = 5 * 60_000;

async function rest<T>(token: string, path: string): Promise<T> {
  return restAnswer<T>(await fetch(`${API}${path}`, restInit(token)), path);
}

/** A REST read whose answer is remembered by its ETag, so asking again before it changes costs no rate limit. */
async function restRemembered<T>(token: string, path: string): Promise<T> {
  return restAnswer<T>(await fetchRemembered(`${API}${path}`, restInit(token)), path);
}

function restInit(token: string) {
  return {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
}

async function restAnswer<T>(response: Response, path: string): Promise<T> {
  if (response.status === 404)
    throw new ProjectUnavailable(
      "GitHub has no such repository, branch or folder, or your account cannot see it.",
      404,
    );
  if (!response.ok) throw new ProjectUnavailable(`GitHub answered ${response.status} reading ${path}.`, 502);
  return response.json() as Promise<T>;
}

/**
 * One GraphQL call to GitHub, answering its data or throwing GitHub's own reason as a 502.
 *
 * @example await graphql<{ viewer: { login: string } }>(token, "{ viewer { login } }", {}); // { viewer: { login: "octocat" } }
 */
export async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const answer = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || !answer.data)
    throw new ProjectUnavailable(answer.errors?.[0]?.message ?? `GitHub answered ${response.status}.`, 502);
  return answer.data;
}

/**
 * Why GitHub shows no such repository, which it answers the same whether it does not exist or is hidden from the editor.
 *
 * @example unseenRepository(parseProjectKey("you/notes")!); // "GitHub shows no you/notes. It does not exist, …"
 */
export function unseenRepository(key: ProjectKey) {
  return `GitHub shows no ${formatProjectKey(key)}. It does not exist, or your account cannot see it.`;
}

/**
 * Resolves a project to the branch its edits land on, the folder holding its `docs/`, and where its uploads are.
 *
 * All three come from `.jotdown/config.json` at the root of the default branch:
 * its `branch`, or else the default branch itself, its `content`, or else the
 * repository root, and its `uploads`, inside the content folder. A repository with no config yet is not remembered, so the
 * folder its setup names is read as soon as setup commits it.
 *
 * @example await resolveTarget(parseProjectKey("you/site")!, token); // { owner: "you", repo: "site", subfolder: "apps/docs", uploads: "docs/_uploads", branch: "main" }
 */
export async function resolveTarget(key: ProjectKey, token: string): Promise<Target> {
  const name = formatProjectKey(key);
  const known = targets.get(name);
  if (known && Date.now() - known.at < TARGET_TTL_MS) return known.target;

  const data = await graphql<{
    repository: { defaultBranchRef: { name: string } | null; config: { text?: string } | null } | null;
  }>(
    token,
    `query Branch($owner: String!, $repo: String!, $config: String!) {
      repository(owner: $owner, name: $repo) {
        defaultBranchRef { name }
        config: object(expression: $config) { ... on Blob { text } }
      }
    }`,
    { owner: key.owner, repo: key.repo, config: `HEAD:${CONFIG_FILE}` },
  );
  if (!data.repository) throw new ProjectUnavailable(unseenRepository(key), 404);
  const text = data.repository.config?.text ?? null;
  const config = parseProjectConfig(text, key.repo);
  const branch = config.branch ?? data.repository.defaultBranchRef?.name;
  if (!branch) throw new ProjectUnavailable(`${name} has no branches yet.`, 404);

  const target = { owner: key.owner, repo: key.repo, subfolder: config.content ?? "", uploads: config.uploads, branch };
  if (text !== null) targets.set(name, { target, at: Date.now() });
  return target;
}

/**
 * Forgets what was settled about a project, so a config just committed is read at once.
 *
 * @example forgetProject({ owner: "you", repo: "site" });
 */
export function forgetProject(key: ProjectKey) {
  targets.delete(formatProjectKey(key));
}

/** The commit a branch points at right now, free of rate limit when it has not moved since the last ask. */
async function readBranchCommit(key: ProjectKey, branch: string, token: string) {
  const ref = await restRemembered<{ object: { sha: string } }>(
    token,
    `/repos/${key.owner}/${key.repo}/git/ref/heads/${encodePath(branch)}`,
  );
  return ref.object.sha;
}

/**
 * Resolves a project to its branch, its content folder and the commit on that branch.
 *
 * Two small reads, done on every page view, so an edit somebody else committed
 * a second ago is what the next page shows. The target is remembered for five
 * minutes and the head by its ETag, so a branch that has not moved costs
 * nothing.
 */
export async function resolveRemote(key: ProjectKey, token: string): Promise<Remote> {
  const target = await resolveTarget(key, token);
  return { ...target, head: await readBranchCommit(key, target.branch, token) };
}

/**
 * The branch a project is edited on and the commit it points at.
 *
 * @example await readHead(parseProjectKey("you/site")!, session); // { branch: "main", head: "ae6ab07…" }
 */
export async function readHead(key: ProjectKey, session: Session) {
  const { branch, head } = await resolveRemote(key, session.token);
  return { branch, head };
}

/**
 * Loads a GitHub project, copying the commit it is at into a local folder once.
 *
 * The folder is named after the commit, so a copy is written once and reused by
 * every page view until somebody commits again. Uploads are not copied but
 * named by their blob addresses, which a page's images point straight at.
 */
export async function openProject(key: ProjectKey, session: Session): Promise<StudioProject> {
  const remote = await resolveRemote(key, session.token);
  const name = formatProjectKey(key);
  const directory = join(
    dataDirectory(),
    "projects",
    createHash("sha256").update(name).digest("hex").slice(0, 24),
    remote.head,
  );

  const [uploads] = await Promise.all([
    readUploadAddresses(remote, session.token).catch(() => ({})),
    existsSync(directory) ? null : copyCommit(remote, session.token, directory),
  ]);
  const text = await readText(join(directory, CONFIG_FILE));
  const config = parseProjectConfig(text, key.repo);

  return {
    id: projectId(name),
    key: name,
    base: projectBase(key),
    directory,
    config,
    uploads,
    version: remote.head,
    fileUrl: fileUrl(remote),
    configured: text !== null,
  };
}

/**
 * Where a file of the project is shown on GitHub, its repository path to be appended.
 *
 * @example fileUrl(remote); // "https://github.com/you/notes/blob/main/"
 */
function fileUrl({ owner, repo, branch, subfolder }: Remote) {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${subfolder ? `${subfolder}/` : ""}`;
}

/**
 * Runs one editing request against a repository, as the editor.
 *
 * The branch and content folder are settled first and pinned for the request,
 * so every GitHub call inside it names the same place.
 */
export async function editing<T>(key: ProjectKey, session: Session, run: () => Promise<T>) {
  const remote = await resolveTarget(key, session.token);
  return editingContext.run({ remote, session }, run);
}

/**
 * Writes the pages and the config of one commit into a folder.
 *
 * The docs folder and the config are fetched side by side, each through the
 * shared cache, so a commit another server instance has read is not asked of
 * GitHub again. Uploads are not copied; each is read by its blob the first
 * time a reader asks for it.
 */
async function copyCommit(remote: Remote, token: string, directory: string) {
  const [pages, config] = await Promise.all([
    readDocsFolder(remote, token),
    atCommit(remote, ["file", CONFIG_FILE], () => readConfig(remote, token)),
  ]);

  const staging = `${directory}.${randomUUID()}`;
  for (const [path, text] of pages) await put(join(staging, "docs", path), text);
  if (config !== null) await put(join(/*turbopackIgnore: true*/ staging, CONFIG_FILE), config);
  await mkdir(join(staging, "docs"), { recursive: true });

  await rename(staging, directory).catch(async (error: NodeJS.ErrnoException) => {
    await rm(staging, { recursive: true, force: true });
    if (!existsSync(directory)) throw error;
  });
}

/**
 * Remembers what a commit holds in Next's data cache, which every server instance shares and deploys keep.
 *
 * Keyed by the commit and never by who asked: a commit's content never
 * changes, and every caller has read the branch head with their own token, so
 * GitHub has already said they may see it. The cache refuses an entry over
 * two megabytes, so callers keep what they store well under that.
 *
 * @example await atCommit(remote, ["file", ".jotdown/config.json"], () => read()); // [[".jotdown/config.json", "{ … }"]]
 */
function atCommit<T>(remote: Remote, what: string[], read: () => Promise<T>) {
  return unstable_cache(read, ["commit", remote.owner, remote.repo, remote.subfolder, remote.head, ...what])();
}

/**
 * Every page and `meta.json` under the commit's docs folder, as text paired with its path inside it.
 *
 * One tree listing names every file with its sha and size, and is cached for
 * the commit like the texts are. The files are read
 * in parts of up to a hundred files and a megabyte, each one GraphQL query and
 * one shared cache entry, all at once. A file too large for any part is read
 * from GitHub every time. A commit with no docs folder, a repository nobody
 * has set up yet, has no pages.
 */
async function readDocsFolder(remote: Remote, token: string) {
  const pages = await atCommit(remote, ["docs-listing"], async () =>
    (await listFolder(remote, token, "docs")).filter((entry) => isContent(entry.path)),
  );
  const parts = await Promise.all(
    inParts(pages).map((part, index) => {
      const read = async () => {
        const texts = await readBlobs(
          remote,
          token,
          part.map((entry) => entry.sha),
        );
        return part.flatMap((entry) => {
          const text = texts.get(entry.sha);
          return text === undefined ? [] : [[entry.path, text] as const];
        });
      };
      return sizeOf(part) > CACHED_PART_BYTES ? read() : atCommit(remote, ["docs", String(index)], read);
    }),
  );

  return parts.flat();
}

/**
 * Whether the studio reads a file under `docs/`: a page, a folder's `meta.json`, or the forwarding record.
 *
 * Anything else sitting in the folder, a spec, a data file or an upload, stays on GitHub.
 *
 * @example isContent("manual/meta.json"); // true
 * @example isContent("vendor/Subscriber.spec.json"); // false
 * @example isContent("_uploads/files/docs/notes.md"); // false
 */
function isContent(path: string) {
  if (inUnderscoreFolder(path)) return false;
  return /\.mdx?$/.test(path) || path === "meta.json" || path.endsWith("/meta.json") || path === "moved.json";
}

/** One file in a tree listing: its path, whether it is a file or a folder, its blob sha, and a file's size. */
type DocsEntry = { path: string; type: string; sha: string; size?: number };

/**
 * Every file under one folder of the content folder at the commit, in one tree listing, or none when the folder is missing.
 *
 * @example await listFolder(remote, token, "docs"); // [{ path: "index.mdx", type: "blob", sha: "3f1c…", size: 812 }]
 */
async function listFolder(remote: Remote, token: string, folder: string) {
  const listing = await rest<{ tree: DocsEntry[]; truncated: boolean }>(
    token,
    `/repos/${remote.owner}/${remote.repo}/git/trees/${remote.head}:${encodePath(inProject(remote, folder))}?recursive=1`,
  ).catch((error: unknown) => {
    if (error instanceof ProjectUnavailable && error.status === 404) return { tree: [], truncated: false };
    throw error;
  });
  if (listing.truncated)
    throw new ProjectUnavailable(`This project's ${folder} folder holds too many files to read in one listing.`, 507);
  return listing.tree.filter((entry) => entry.type === "blob");
}

/**
 * Splits a listing into runs of at most a hundred files and a megabyte, in listing order.
 *
 * @example inParts([{ size: 900_000 }, { size: 300_000 }]); // [[{ size: 900_000 }], [{ size: 300_000 }]]
 */
function inParts(entries: DocsEntry[]) {
  const parts: DocsEntry[][] = [];
  for (const entry of entries) {
    const last = parts.at(-1);
    const fits = last && last.length < BLOBS_PER_QUERY && sizeOf(last) + (entry.size ?? 0) <= CACHED_PART_BYTES;
    if (fits) last.push(entry);
    else parts.push([entry]);
  }
  return parts;
}

function sizeOf(entries: DocsEntry[]) {
  return entries.reduce((total, entry) => total + (entry.size ?? 0), 0);
}

/**
 * The text of `.jotdown/config.json` at the repository root, or null when the repository has none.
 *
 * The config sits at the repository root and is copied beside `docs/`.
 */
async function readConfig(remote: Remote, token: string) {
  return (await readAt(remote, token, [CONFIG_FILE])).get(CONFIG_FILE) ?? null;
}

/** What GraphQL answers for a blob: its text, unless it is binary or too long to send whole. */
type BlobAnswer = { oid?: string; text?: string | null; isTruncated?: boolean } | null;

/**
 * A blob's text, fetched whole when GraphQL cut it short.
 *
 * GraphQL truncates a long blob, a two-megabyte page say, and says so;
 * the REST blob endpoint sends it whole. A binary blob has no text and is skipped.
 */
async function blobText(remote: Remote, token: string, answer: BlobAnswer | undefined) {
  if (!answer || typeof answer.text !== "string") return null;
  if (!answer.isTruncated || !answer.oid) return answer.text;

  const response = await fetch(`${API}/repos/${remote.owner}/${remote.repo}/git/blobs/${answer.oid}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github.raw+json",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new ProjectUnavailable(`GitHub answered ${response.status} reading a large file.`, 502);
  return response.text();
}

/** Fetches blob texts by sha, a hundred aliases per query, skipping those already cached. */
async function readBlobs(remote: Remote, token: string, shas: string[]) {
  const missing = [...new Set(shas)].filter((sha) => !blobs.has(sha));
  for (let at = 0; at < missing.length; at += BLOBS_PER_QUERY) {
    const batch = missing.slice(at, at + BLOBS_PER_QUERY);
    const fields = batch
      .map((sha, index) => `b${index}: object(oid: "${sha}") { ... on Blob { oid text isTruncated } }`)
      .join("\n");
    const data = await graphql<{ repository: Record<string, BlobAnswer> }>(
      token,
      `query Blobs($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
      { owner: remote.owner, repo: remote.repo },
    );
    await Promise.all(
      batch.map(async (sha, index) => {
        const text = await blobText(remote, token, data.repository[`b${index}`]);
        if (text !== null) blobs.set(sha, text);
      }),
    );
  }
  return new Map(
    shas.flatMap((sha) => {
      const text = blobs.get(sha);
      return text === undefined ? [] : [[sha, text] as const];
    }),
  );
}

/** Reads files at the commit by their path from the repository root, leaving out any that do not exist. */
async function readAt(remote: Remote, token: string, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const fields = paths
    .map((_, index) => `f${index}: object(expression: $e${index}) { ... on Blob { oid text isTruncated } }`)
    .join("\n");
  const variables = Object.fromEntries(paths.map((path, index) => [`e${index}`, `${remote.head}:${path}`]));
  const declared = paths.map((_, index) => `$e${index}: String!`).join(", ");
  const data = await graphql<{ repository: Record<string, BlobAnswer> }>(
    token,
    `query Files($owner: String!, $repo: String!, ${declared}) { repository(owner: $owner, name: $repo) { ${fields} } }`,
    { owner: remote.owner, repo: remote.repo, ...variables },
  );
  const texts = await Promise.all(
    paths.map((path, index) =>
      blobText(remote, token, data.repository[`f${index}`]).then((text) => [path, text] as const),
    ),
  );
  return new Map(texts.filter((entry): entry is readonly [string, string] => entry[1] !== null));
}

/**
 * One upload of the project at its branch head, from its uploads folder, sent on to its blob address.
 *
 * A stylesheet is answered in place instead, so the fonts and images it names
 * resolve against the project rather than against a blob.
 *
 * @example await readUpload(key, session, "img/docs/a.png"); // 307 to /api/blobs/you/notes/3f1c…/a.png
 */
export async function readUpload(key: ProjectKey, session: Session, path: string) {
  const remote = await resolveRemote(key, session.token).catch(() => null);
  if (!remote) return null;

  const blobs = await readUploadBlobs(remote, session.token).catch(() => null);
  const file = uploadFile(path, remote.uploads);
  const sha = blobs?.[file];
  if (!sha) return null;

  if (uploadType(file) === "text/css") return readBlob(key, session.token, sha);
  return new Response(null, { status: 307, headers: { location: blobAddress(key, sha, file) } });
}

/**
 * Every file under the commit's uploads folder, its path in the content folder paired with its blob sha.
 *
 * One tree listing, cached for the commit, so a page names all of its images
 * without asking GitHub anything more.
 *
 * @example await readUploadBlobs(remote, token); // { "docs/_uploads/img/a.png": "3f1c…" }
 */
async function readUploadBlobs(remote: Remote, token: string) {
  return atCommit(remote, ["upload-blobs", remote.uploads], async () => {
    const uploads = await listFolder(remote, token, remote.uploads);
    return Object.fromEntries(uploads.map((entry) => [`${remote.uploads}/${entry.path}`, entry.sha] as const));
  });
}

/**
 * The commit's uploads by their path in the content folder, each paired with its blob address.
 *
 * @example await readUploadAddresses(remote, token); // { "docs/_uploads/img/a.png": "/api/blobs/you/notes/3f1c…/a.png" }
 */
async function readUploadAddresses(remote: Remote, token: string) {
  const blobs = await readUploadBlobs(remote, token);
  return Object.fromEntries(Object.entries(blobs).map(([path, sha]) => [path, blobAddress(remote, sha, path)]));
}

/**
 * Where the studio serves one blob for good: its repository, its sha, and the file name it is saved under.
 *
 * @example blobAddress({ owner: "you", repo: "notes" }, "3f1c…", "img/docs/a.png"); // "/api/blobs/you/notes/3f1c…/a.png"
 */
function blobAddress({ owner, repo }: ProjectKey, sha: string, path: string) {
  return `/api/blobs/${owner}/${repo}/${sha}/${encodeURIComponent(basename(path))}`;
}

/**
 * One blob of the repository by its sha, as GitHub streams it, or null when the token cannot read it.
 *
 * @example await readBlob(key, token, "3f1c…"); // Response with the bytes
 */
export async function readBlob(key: ProjectKey, token: string, sha: string) {
  const response = await fetch(`${API}/repos/${key.owner}/${key.repo}/git/blobs/${sha}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github.raw+json",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok ? response : null;
}

/**
 * A project's look at its branch head: its title, its theme as a stylesheet, and its logos' blob addresses.
 *
 * Read straight from GitHub rather than through the pages, so the look can
 * arrive before they do, and remembered for the commit, so opening a project
 * again asks GitHub only where its branch is.
 *
 * @example await readBrand(key, session); // { branch: "main", head: "ae6ab07…", title: "Handbook", stylesheet: ":root { … }", logo: { alt, src: "/api/blobs/…" }, theme }
 */
export async function readBrand(key: ProjectKey, session: Session): Promise<ProjectLook> {
  const remote = await resolveRemote(key, session.token);
  return atCommit(remote, ["look"], () => readLook(remote, session.token));
}

async function readLook(remote: Remote, token: string): Promise<ProjectLook> {
  const config = parseProjectConfig(
    await atCommit(remote, ["file", CONFIG_FILE], () => readConfig(remote, token)),
    remote.repo,
  );
  const { logo, title, theme } = config;

  const [src, srcDark] = await Promise.all([
    logo ? uploadAddress(remote, token, logo.src) : null,
    logo?.srcDark ? uploadAddress(remote, token, logo.srcDark) : null,
  ]);
  const stylesheet = themeStylesheet(theme, `/${remote.owner}/${remote.repo}`) || null;

  return {
    branch: remote.branch,
    head: remote.head,
    title,
    stylesheet,
    logo: logo && src ? { alt: logo.alt, src, srcDark: srcDark ?? src } : null,
    theme,
  };
}

/** One upload's blob address, read from the commit's upload listing, or null when the project does not have it. */
async function uploadAddress(remote: Remote, token: string, address: string) {
  const blobs = await readUploadBlobs(remote, token).catch(() => null);
  const file = uploadFile(address, remote.uploads);
  const sha = blobs?.[file];
  return sha ? blobAddress(remote, sha, file) : null;
}

/**
 * Every one of the editor's recently pushed repositories that has a `.jotdown/config.json` at its root.
 */
export async function listProjects({ token }: Session): Promise<ProjectListing[]> {
  const reads = await readProjectConfigs(token, await reachableRepositories(token));
  return reads.flatMap((read) => (read.listing ? [read.listing] : [])).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The editor's saved projects, each read from GitHub in one round.
 *
 * Far cheaper than listing every reachable repository, so the switcher can
 * open on it. A key saved in two spellings is read once.
 *
 * @example await readBookmarks(session, [{ owner: "grace", repo: "talks" }]); // [{ key: "grace/talks", locked: false, … }]
 */
export async function readBookmarks({ token }: Session, saved: ProjectKey[]): Promise<Bookmark[]> {
  const names = saved.map(({ owner, repo }): [string, string] => [owner, repo]);
  const unique = [...new Map(names.map((name) => [name.join("/").toLowerCase(), name])).values()];
  const reads = await readProjectConfigs(token, unique);

  return reads.map((read) => ({
    key: read.key,
    title: read.listing?.title ?? read.repo,
    icon: read.listing?.icon ?? null,
    locked: !read.reachable,
  }));
}

/** Each repository's `.jotdown/config.json` read as a listing, fifty to a GraphQL query, and whether GitHub showed the repository at all. */
async function readProjectConfigs(token: string, repositories: [string, string][]) {
  const reads: ProjectRead[] = [];

  for (let at = 0; at < repositories.length; at += 50) {
    const batch = repositories.slice(at, at + 50);
    const fields = batch
      .map(
        ([owner, repo], index) =>
          `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { object(expression: ${JSON.stringify(`HEAD:${CONFIG_FILE}`)}) { ... on Blob { text } } }`,
      )
      .join("\n");
    const data = await graphql<Record<string, { object: { text?: string | null } | null } | null>>(
      token,
      `query Projects { ${fields} }`,
      {},
    );

    batch.forEach(([owner, repo], index) => {
      const found = data[`r${index}`];
      const key = `${owner}/${repo}`;
      reads.push({ key, owner, repo, reachable: Boolean(found), ...projectListing(key, repo, found?.object?.text) });
    });
  }

  return withIconAddresses(token, reads);
}

/** One repository as the switcher reads it: its listing, the content folder and the uploads folder inside it, and whether GitHub showed it. */
type ProjectRead = ProjectKey & {
  key: string;
  reachable: boolean;
  listing: ProjectListing | null;
  subfolder: string;
  uploads: string;
};

/** What GitHub answers for each repository's icon: the blob it names, or null for a file it does not hold. */
type IconAnswer = Record<string, { icon: { oid: string } | null } | null>;

/**
 * The reads with each icon named by its blob address, the files looked up fifty repositories to a GraphQL query.
 *
 * An icon the repository does not hold, or one GitHub would not look up, is
 * dropped, and the switcher draws the project's initial.
 */
async function withIconAddresses(token: string, reads: ProjectRead[]) {
  const iconed = reads.flatMap((read) =>
    read.listing?.icon ? [{ read, file: uploadFile(read.listing.icon, read.uploads) }] : [],
  );
  const shas = new Map<ProjectRead, string>();

  for (let at = 0; at < iconed.length; at += 50) {
    const batch = iconed.slice(at, at + 50);
    const fields = batch
      .map(
        ({ read, file }, index) =>
          `r${index}: repository(owner: ${JSON.stringify(read.owner)}, name: ${JSON.stringify(read.repo)}) { icon: object(expression: ${JSON.stringify(`HEAD:${inProject(read, file)}`)}) { oid } }`,
      )
      .join("\n");
    const data = await graphql<IconAnswer>(token, `query Icons { ${fields} }`, {}).catch((): IconAnswer => ({}));

    batch.forEach(({ read }, index) => {
      const found = data[`r${index}`]?.icon;
      if (found) shas.set(read, found.oid);
    });
  }

  return reads.map((read) => {
    if (!read.listing?.icon) return read;
    const sha = shas.get(read);
    return { ...read, listing: { ...read.listing, icon: sha ? blobAddress(read, sha, read.listing.icon) : null } };
  });
}

/** A repository's listing from its `.jotdown/config.json` text, or null when it has none, with the folders it names. */
function projectListing(
  key: string,
  repo: string,
  text: string | null | undefined,
): Pick<ProjectRead, "listing" | "subfolder" | "uploads"> {
  if (typeof text !== "string") return { listing: null, subfolder: "", uploads: UPLOADS_FOLDER };
  try {
    const config = parseProjectConfig(text, repo);
    return {
      listing: {
        key,
        title: config.title,
        description: config.description,
        icon: config.favicon ?? config.logo?.src ?? null,
      },
      subfolder: config.content ?? "",
      uploads: config.uploads,
    };
  } catch {
    return {
      listing: { key, title: repo, description: ".jotdown/config.json could not be read.", icon: null },
      subfolder: "",
      uploads: UPLOADS_FOLDER,
    };
  }
}

/**
 * The editor's most recently pushed repositories, as owner and name.
 *
 * @example await reachableRepositories(token); // [["you", "notes"], ["you", "site"]]
 */
export async function reachableRepositories(token: string) {
  const repositories = await rest<{ full_name: string }[]>(token, "/user/repos?per_page=100&sort=pushed");
  return repositories.map((repo) => repo.full_name.split("/") as [string, string]);
}

function inProject({ subfolder }: { subfolder: string }, path: string) {
  return subfolder ? `${subfolder}/${path}` : path;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function put(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

async function readText(path: string) {
  return existsSync(path) ? readFile(path, "utf8") : null;
}
