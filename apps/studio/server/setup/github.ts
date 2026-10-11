import { posix } from "node:path";
import { formatProjectKey, type ProjectKey } from "../../lib/project-key";
import type { Inspection, SetupTarget } from "../../lib/setup";
import { graphql, reachableRepositories, unseenRepository } from "../storage/github/projects";
import type { Session } from "../auth/session";
import type { Write } from "./plan";
import { suggestedTitle } from "./suggest";

/**
 * Setting up a GitHub repository: what it holds before, and the one commit that makes it a project.
 *
 * Every call is made with the editor's own token, so GitHub decides what they
 * may read and write. The commit is built with the git database API rather
 * than `createCommitOnBranch`, because the skills' links into `.claude/skills/`
 * are symlinks, which only a tree can carry.
 */

const API = "https://api.github.com";
const TIMEOUT_MS = 20_000;
const WRITERS = new Set(["ADMIN", "MAINTAIN", "WRITE"]);

/**
 * Every repository the editor can reach, by key, in name order.
 *
 * @example await listRepositories(session); // ["you/notes", "you/site"]
 */
export async function listRepositories(session: Session) {
  const names = await reachableRepositories(session.token);
  return names
    .map(([owner, repo]) => `${owner}/${repo}`)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

type Entry = { name: string; type: string };

type RepositoryAnswer = {
  repository: {
    description: string | null;
    url: string;
    isEmpty: boolean;
    viewerPermission: string | null;
    defaultBranchRef: { name: string } | null;
    config: { text?: string } | null;
    root: { entries?: Entry[] } | null;
  } | null;
};

/**
 * What a repository holds before setup, and whether the editor can set it up at all.
 *
 * @example await inspectRepository({ owner: "you", repo: "site" }, session); // { name: "you/site", branch: "main", problem: null, … }
 */
export async function inspectRepository(key: ProjectKey, session: Session): Promise<Inspection> {
  const name = formatProjectKey(key);
  const target: SetupTarget = { kind: "github", key: name };

  const { repository } = await graphql<RepositoryAnswer>(
    session.token,
    `query Inspect($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        description url isEmpty viewerPermission
        defaultBranchRef { name }
        config: object(expression: "HEAD:.jotdown/config.json") { ... on Blob { text } }
        root: object(expression: "HEAD:") { ... on Tree { entries { name type } } }
      }
    }`,
    { owner: key.owner, repo: key.repo },
  );

  const blank = {
    target,
    name,
    title: suggestedTitle(key.repo),
    description: "",
    branch: null,
    repository: null,
    agentFile: null,
  } satisfies Omit<Inspection, "problem">;
  if (!repository) {
    return { ...blank, problem: { kind: "unreachable", message: unseenRepository(key) } };
  }

  const root = repository.root?.entries ?? [];
  const found = {
    ...blank,
    description: repository.description ?? "",
    branch: repository.defaultBranchRef?.name ?? null,
    repository: repository.url,
    agentFile: agentFileOf(root.map((entry) => entry.name)),
  };

  if (repository.isEmpty || !found.branch)
    return {
      ...found,
      problem: { kind: "empty", message: `${name} has no commits yet. Add a README on GitHub first, then set it up.` },
    };
  if (repository.config?.text !== undefined)
    return {
      ...found,
      problem: { kind: "configured", message: `${name} is a Jotdown project already.`, open: `/${name}` },
    };
  if (!WRITERS.has(repository.viewerPermission ?? ""))
    return {
      ...found,
      problem: {
        kind: "readonly",
        message: `Your account can read ${name} but not commit to it. Ask for write access.`,
      },
    };
  return { ...found, problem: null };
}

/**
 * Which of some paths exist on the default branch, the text of the agent instructions files among them, and which of some folders are files instead.
 *
 * One GraphQL query, however many paths. A symlink is a file to git, so a
 * linked skill folder counts as a file standing where the plan needs a folder.
 *
 * @example await readExisting(key, session, ["AGENTS.md"], [".agents/skills/blocks"]); // { existing: Set { "AGENTS.md" }, notes: { "AGENTS.md": "# Agents…" }, standing: Set { ".agents/skills/blocks" } }
 */
export async function readExisting(key: ProjectKey, session: Session, paths: string[], folders: string[]) {
  const fields = [...paths, ...folders]
    .map(
      (path, index) =>
        `f${index}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { __typename ... on Blob { text } }`,
    )
    .join("\n");
  const data = await graphql<{
    repository: Record<string, { __typename?: string; text?: string | null } | null> | null;
  }>(
    session.token,
    `query Existing($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
    { owner: key.owner, repo: key.repo },
  );
  const answer = (index: number) => data.repository?.[`f${index}`];

  const existing = new Set<string>();
  const notes: Partial<Record<"AGENTS.md" | "CLAUDE.md", string>> = {};
  paths.forEach((path, index) => {
    const found = answer(index);
    if (!found) return;
    existing.add(path);
    if (path === "AGENTS.md" || path === "CLAUDE.md") notes[path] = found.text ?? "";
  });
  const standing = new Set(folders.filter((_, index) => answer(paths.length + index)?.__typename === "Blob"));

  return { existing, notes, standing };
}

/**
 * The names of what the content folder holds on the default branch, or none when the branch does not have it.
 *
 * @example await readHolding({ owner: "you", repo: "site" }, session, "apps/docs"); // ["app", "docs", "package.json"]
 */
export async function readHolding(key: ProjectKey, session: Session, content: string) {
  const { repository } = await graphql<{ repository: { folder: { entries?: { name: string }[] } | null } | null }>(
    session.token,
    `query Holding($owner: String!, $repo: String!, $folder: String!) {
      repository(owner: $owner, name: $repo) {
        folder: object(expression: $folder) { ... on Tree { entries { name } } }
      }
    }`,
    { owner: key.owner, repo: key.repo, folder: content ? `HEAD:${content}` : "HEAD:" },
  );

  return repository?.folder?.entries?.map((entry) => entry.name) ?? [];
}

/**
 * Commits every write in one commit onto the default branch, as the editor.
 *
 * Text and links go into the tree inline. An upload is sent as a blob first,
 * since a tree only takes text. A move or a deletion names a file or a folder,
 * so it is spelled out file by file from the branch's own tree: a moved file
 * keeps its blob at its new path, and a deleted one is an entry with no blob.
 * It refuses if the branch moved meanwhile.
 *
 * @example await commitSetup({ owner: "you", repo: "site" }, "main", writes, session);
 */
export async function commitSetup(key: ProjectKey, branch: string, writes: Write[], session: Session) {
  const repo = `/repos/${key.owner}/${key.repo}`;
  const call = <T>(method: string, path: string, body?: unknown) =>
    request<T>(session.token, method, `${repo}${path}`, body);

  const head = await call<{ object: { sha: string } }>("GET", `/git/ref/heads/${encodeURIComponent(branch)}`);
  const parent = await call<{ tree: { sha: string } }>("GET", `/git/commits/${head.object.sha}`);

  const entries = new Map<string, TreeChange>();
  for (const change of await spelledOut(call, head.object.sha, parent.tree.sha, writes)) {
    if (change.sha !== null || !entries.has(change.path)) entries.set(change.path, change);
  }

  const files = await Promise.all(
    writes
      .flatMap((write) => ("content" in write || "link" in write ? [write] : []))
      .map(async (write): Promise<TreeChange> => {
        if ("link" in write) return { path: write.path, mode: "120000", type: "blob", content: write.link };
        if (!("content" in write)) throw new Error("A write with nothing to write.");
        if (typeof write.content === "string")
          return { path: write.path, mode: "100644", type: "blob", content: write.content };

        const blob = await call<{ sha: string }>("POST", "/git/blobs", {
          content: Buffer.from(write.content).toString("base64"),
          encoding: "base64",
        });
        return { path: write.path, mode: "100644", type: "blob", sha: blob.sha };
      }),
  );
  for (const file of files) entries.set(file.path, file);

  const tree = await call<{ sha: string }>("POST", "/git/trees", {
    base_tree: parent.tree.sha,
    tree: [...entries.values()],
  });
  const commit = await call<{ sha: string }>("POST", "/git/commits", {
    message: "docs: (studio) set up Jotdown\n\nWritten by the Jotdown setup wizard.",
    tree: tree.sha,
    parents: [head.object.sha],
  });

  await call("PATCH", `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false });
}

/** One entry of a new tree: a file written, kept at a new path by its blob, or deleted with no blob. */
type TreeChange = { path: string; mode: string; type: string; sha?: string | null; content?: string };

type Call = <T>(method: string, path: string, body?: unknown) => Promise<T>;

type Listed = { path: string; mode: string; type: string; sha: string };

/**
 * Every move and deletion as tree entries, file by file, read off the branch's tree.
 *
 * Each named path is looked up in its folder's listing, and a folder is listed
 * whole, so a path the branch does not have changes nothing.
 */
async function spelledOut(call: Call, head: string, rootTree: string, writes: Write[]): Promise<TreeChange[]> {
  const nodes = writes.flatMap((write) =>
    "from" in write
      ? [{ path: write.from, to: write.path as string | null }]
      : "remove" in write
        ? [{ path: write.path, to: null }]
        : [],
  );
  if (nodes.length === 0) return [];

  const parents = [...new Set(nodes.map((node) => posix.dirname(node.path)))];
  const listings = new Map(
    await Promise.all(
      parents.map(async (folder) => {
        const listed = await call<{ tree: Listed[] }>(
          "GET",
          `/git/trees/${folder === "." ? rootTree : `${head}:${encodePath(folder)}`}`,
        ).catch(() => ({ tree: [] as Listed[] }));
        return [folder, listed.tree] as const;
      }),
    ),
  );

  const changes = await Promise.all(
    nodes.map(async (node): Promise<TreeChange[]> => {
      const name = posix.basename(node.path);
      const found = listings.get(posix.dirname(node.path))?.find((entry) => entry.path === name);
      if (!found) return [];

      const files =
        found.type === "tree"
          ? (await call<{ tree: Listed[] }>("GET", `/git/trees/${found.sha}?recursive=1`)).tree
              .filter((entry) => entry.type !== "tree")
              .map((entry) => ({ ...entry, path: `${node.path}/${entry.path}` }))
          : [{ ...found, path: node.path }];

      return files.flatMap((file): TreeChange[] => [
        { path: file.path, mode: file.mode, type: file.type, sha: null },
        ...(node.to === null
          ? []
          : [{ path: node.to + file.path.slice(node.path.length), mode: file.mode, type: file.type, sha: file.sha }]),
      ]);
    }),
  );

  return changes.flat();
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** One REST call to GitHub, throwing GitHub's own reason when it refuses. */
async function request<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.ok) return response.json() as Promise<T>;

  const message =
    ((await response.json().catch(() => null)) as { message?: string } | null)?.message ??
    `GitHub answered ${response.status}.`;
  if (response.status === 422 && /fast.?forward/i.test(message))
    throw new Error("Somebody pushed while the project was being set up. Create it again.");
  if (response.status === 403 || response.status === 404)
    throw new Error(`GitHub refused the commit: ${message}. Your account may lack write access to this repository.`);
  throw new Error(`GitHub refused the commit: ${message}`);
}

/** The agent instructions file a repository root holds, `AGENTS.md` first. */
export function agentFileOf(names: string[]): Inspection["agentFile"] {
  return names.includes("AGENTS.md") ? "AGENTS.md" : names.includes("CLAUDE.md") ? "CLAUDE.md" : null;
}
