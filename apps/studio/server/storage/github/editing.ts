import { HISTORY_PAGE_SIZE, MAX_REVISION_BYTES, revisionAuthors, revisionText } from "../../live-edit/_history";
import { pageWriteRefusal } from "../../live-edit/_generated";
import type { Corpus } from "../../live-edit/_structure";
import { CONTENT_PATH, META_PATH, type Failure, type Result } from "../../live-edit/_contract";
import { DOCS_ROOT, finalHome, MOVED_FILE, repoPath, type Move } from "@jotdown/core/lib/paths";
import type { Addition, AssetUpload, CommitOutcome, Docs, TreeCommit } from "../types";
import { editingContext } from "./context";
import { fetchRemembered } from "./remembered";
import type {
  AssetResponse,
  PageHistoryResponse,
  PageRevisionResponse,
  SaveRequest,
  SaveResponse,
  SourceResponse,
} from "@jotdown/editor/types";

/**
 * The GitHub calls behind live-edit.
 *
 * Nothing here authenticates the caller. Every call is made with the signed-in
 * editor's own GitHub token, so GitHub itself refuses anything their account
 * may not do.
 */

const API_VERSION = "2022-11-28";
const GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_TIMEOUT_MS = 10_000;

const UNREACHABLE: Failure = {
  status: 504,
  error: "GitHub could not be reached. Try again in a moment.",
};

const UNREADABLE_REF: Failure = {
  status: 502,
  error: "GitHub would not say which commit the branch is at. Try again in a moment.",
};

/**
 * Reads a doc at branch HEAD, with the blob sha needed to write it back.
 *
 * Deliberately the GitHub contents API and not raw.githubusercontent.com: the
 * raw host does not authenticate against a private repo and never returns a
 * sha.
 */
export async function readSource(path: string): Promise<Result<SourceResponse>> {
  const config = readConfig();
  if (!config.ok) return config;

  const url = `${contentsUrl(config.value, path)}?ref=${encodeURIComponent(config.value.branch)}`;
  const call = await attempt(() => github(url, { headers: githubHeaders(config.value.token) }), UNREACHABLE);
  if (!call.ok) return call;
  const response = call.value;

  if (response.status === 404) {
    return {
      ok: false,
      failure: { status: 404, error: `${path} does not exist on ${config.value.branch}.` },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      failure: {
        status: 502,
        error: `GitHub refused to read ${path} (${response.status}): ${await readMessage(response)}`,
      },
    };
  }

  const parsed = await attempt(() => response.json() as Promise<{ content?: string; encoding?: string; sha: string }>, {
    status: 502,
    error: "GitHub returned something that was not a file.",
  });
  if (!parsed.ok) return parsed;
  const file = parsed.value;

  // Anything over a megabyte comes back with `encoding: "none"` and no content,
  // and a directory comes back as an array with no encoding at all.
  if (file.encoding !== "base64" || file.content === undefined) {
    return {
      ok: false,
      failure: { status: 422, error: `${path} is too large or is not a single file.` },
    };
  }

  return {
    ok: true,
    value: { path, text: decodeContent(file.content), sha: file.sha },
  };
}

/**
 * How many files the corpus reader will pull down in one go.
 *
 * Every doc has to be in memory for links to be repaired, and every one of them
 * is an alias in a single GraphQL query. A project that outgrows this wants
 * paging rather than a bigger number, so it says so instead of quietly
 * rewriting half the links.
 */
const CORPUS_LIMIT = 400;

/**
 * Reads every doc and category file on the branch, in two requests.
 *
 * One recursive tree listing gives the paths and their blob shas, and one
 * GraphQL query with an alias per blob gives the texts. Fetching them one at a
 * time would be forty round trips and, worse, forty chances to read half the
 * corpus from before somebody else's commit and half from after. The tree sha
 * pins all of it to one moment.
 *
 * The listing asks for the content folder rather than the whole repository,
 * which is what `head:docs` means to the trees endpoint. GitHub truncates a
 * listing past its own size ceiling and a repository holding an application
 * beside its docs can reach it, so asking for the branch root would make the
 * arranger fail on a repository whose docs are perfectly small. Paths come back
 * relative to the folder asked for, so the content root goes back on before
 * anything reads them.
 */
export async function readDocs(): Promise<Result<Docs>> {
  const config = readConfig();
  if (!config.ok) return config;

  const head = await readBranchHead(config.value);
  if (!head.ok) return head;

  const root = encodePath(repoPath(DOCS_ROOT, config.value.subfolder));

  const listed = await attempt(
    () =>
      github(`${gitUrl(config.value)}/trees/${head.value}:${root}?recursive=1`, {
        headers: githubHeaders(config.value.token),
      }),
    UNREACHABLE,
  );
  if (!listed.ok) return listed;

  if (listed.value.status === 404) return { ok: false, failure: missingContentRoot(root) };

  if (!listed.value.ok) {
    return {
      ok: false,
      failure: describeWriteFailure(listed.value.status, await readMessage(listed.value)),
    };
  }

  const tree = await attempt(() => listed.value.json() as Promise<{ tree?: TreeEntry[]; truncated?: boolean }>, {
    status: 502,
    error: "GitHub listed the repository unreadably.",
  });
  if (!tree.ok) return tree;

  if (tree.value.truncated) {
    return {
      ok: false,
      failure: { status: 507, error: `${DOCS_ROOT}/ holds too many files to read in one listing.` },
    };
  }

  const wanted = (tree.value.tree ?? [])
    .map((entry) => ({ ...entry, path: `${DOCS_ROOT}/${entry.path}` }))
    .filter(({ type, path }) => type === "blob" && (CONTENT_PATH.test(path) || META_PATH.test(path)));

  if (wanted.length > CORPUS_LIMIT) {
    return {
      ok: false,
      failure: {
        status: 507,
        error: `This project has ${wanted.length} pages, past the ${CORPUS_LIMIT} that can be rearranged in one go.`,
      },
    };
  }

  const texts = await readBlobs(config.value, wanted);
  if (!texts.ok) return texts;

  return { ok: true, value: { head: head.value, corpus: texts.value } };
}

type TreeEntry = { path: string; type: string; sha: string };

/**
 * Pulls a list of blobs down as one query, aliased by position.
 *
 * A blob GitHub considers binary answers with a null `text`, which no doc ever
 * is, so one is dropped rather than committed back as an empty file. A blob
 * too long for GraphQL to send whole comes back cut short, and is read again
 * in full, because committing the short copy back would lose the rest of it.
 */
async function readBlobs(config: Config, entries: TreeEntry[]): Promise<Result<Corpus>> {
  if (entries.length === 0) return { ok: true, value: new Map() };

  const fields = entries
    .map((entry, index) => `b${index}: object(oid: "${entry.sha}") { ... on Blob { text isTruncated } }`)
    .join("\n    ");

  const query = `query Docs($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    ${fields}
  }
}`;

  const answered = await graphql<{
    repository: Record<string, { text?: string | null; isTruncated?: boolean } | null>;
  }>(config, query, { owner: config.owner, repo: config.repo });
  if (!answered.ok) return answered;
  if (answered.value.moved) {
    return { ok: false, failure: { status: 502, error: "GitHub answered a read as a conflict." } };
  }

  const { repository } = answered.value.data;
  const corpus: Corpus = new Map();

  for (const [index, entry] of entries.entries()) {
    const answer = repository?.[`b${index}`];
    if (typeof answer?.text !== "string") continue;
    if (!answer.isTruncated) {
      corpus.set(entry.path, answer.text);
      continue;
    }
    const whole = await readWholeBlob(config, entry);
    if (!whole.ok) return whole;
    corpus.set(entry.path, whole.value);
  }

  return { ok: true, value: corpus };
}

/**
 * One blob's full text from the REST endpoint, for a page GraphQL cut short.
 *
 * GraphQL truncates a long blob, a changelog that has grown for years say, and
 * says so. Writing that text back would lose the rest of the page, so the
 * whole blob is read again from the endpoint that sends it all.
 */
async function readWholeBlob(config: Config, entry: TreeEntry): Promise<Result<string>> {
  const call = await attempt(
    () =>
      github(`${gitUrl(config)}/blobs/${entry.sha}`, {
        headers: { ...githubHeaders(config.token), accept: "application/vnd.github.raw+json" },
      }),
    UNREACHABLE,
  );
  if (!call.ok) return call;
  if (!call.value.ok) {
    return {
      ok: false,
      failure: { status: 502, error: `GitHub would not send ${entry.path} whole (${call.value.status}).` },
    };
  }
  return { ok: true, value: await call.value.text() };
}

/** The commit the branch points at, refusing rather than guessing when it has none. */
async function readBranchHead(config: Config): Promise<Result<string>> {
  const head = await readRefTarget(config, `refs/heads/${config.branch}`);
  if (!head.ok) return head;

  return head.value
    ? { ok: true, value: head.value }
    : { ok: false, failure: { status: 502, error: `GitHub does not have a ${config.branch} branch.` } };
}

/**
 * The one mutation, asking for the commit and optionally one file's new sha.
 *
 * `Commit.file` is why the read-back costs nothing: a save needs the new blob
 * sha so a second save works without reloading, and a separate contents call to
 * fetch it would race the next person's commit.
 */
const COMMIT_MUTATION = `
mutation Commit($input: CreateCommitOnBranchInput!, $blobFor: String!, $readBlob: Boolean!) {
  createCommitOnBranch(input: $input) {
    commit {
      oid
      file(path: $blobFor) @include(if: $readBlob) { oid }
    }
  }
}`;

/**
 * Writes any number of files and removes any number of others, in one commit.
 *
 * This is the only thing in live-edit that writes to the branch. It is GraphQL
 * rather than the contents API for two reasons: the contents API commits
 * exactly one file per call, which cannot express a move without a window where
 * the page exists twice or not at all, and GitHub signs what it commits here,
 * which the contents API does not.
 *
 * The cost is authorship. `createCommitOnBranch` always records the token as
 * the author, so the human's name and email go in a `Co-authored-by` trailer
 * and GitHub renders them as a second face on the commit.
 *
 * `expectedHead` makes the whole commit compare-and-swap on the branch tip. A
 * batch that touches six paths either lands whole or is refused whole, which is
 * what stops a half-applied move. A refusal comes back as `{ moved: true }`
 * rather than a failure, because whether to retry or to tell the reader depends
 * on what the caller was writing.
 */
export async function commitTree(commit: TreeCommit): Promise<Result<CommitOutcome>> {
  const config = readConfig();
  if (!config.ok) return config;

  const input = {
    branch: {
      repositoryNameWithOwner: `${config.value.owner}/${config.value.repo}`,
      branchName: config.value.branch,
    },
    expectedHeadOid: commit.expectedHead,
    message: { headline: commit.message, body: coAuthoredBy(commit.author) },
    fileChanges: {
      additions: (commit.additions ?? []).map(({ path, content }) => ({
        path: repoPath(path, config.value.subfolder),
        contents: base64(content),
      })),
      deletions: (commit.deletions ?? []).map((path) => ({ path: repoPath(path, config.value.subfolder) })),
    },
  };

  const answer = await graphql<CommitedPayload>(config.value, COMMIT_MUTATION, {
    input,
    blobFor: commit.blobFor ? repoPath(commit.blobFor, config.value.subfolder) : "",
    readBlob: Boolean(commit.blobFor),
  });
  if (!answer.ok) return answer;
  if (answer.value.moved) return { ok: true, value: { moved: true } };

  const made = answer.value.data.createCommitOnBranch?.commit;
  if (!made) {
    return {
      ok: false,
      failure: {
        status: 502,
        error: "GitHub accepted the commit but did not say what it made. Reload to confirm it landed.",
      },
    };
  }

  return {
    ok: true,
    value: { moved: false, commitSha: made.oid, blobSha: made.file?.oid ?? null },
  };
}

type CommitedPayload = {
  createCommitOnBranch?: { commit?: { oid: string; file?: { oid: string } | null } | null } | null;
};

/**
 * How many times a save re-reads and tries again when the branch moved.
 *
 * A commit to any file moves the tip, so an unrelated colleague pressing Save
 * one second earlier would otherwise read as a conflict on a page they never
 * touched. Three is enough for a busy minute and small enough that a genuinely
 * hot branch says so rather than hanging.
 */
const HEAD_RETRIES = 3;

/**
 * Commits a doc and its prepared drawing assets to the branch together.
 *
 * The stale-write check is ours rather than GitHub's, because
 * `createCommitOnBranch` has no per-file precondition: it guards the branch tip
 * and nothing else. So the head is read first, the file's current sha second,
 * and a sha that no longer matches the one the browser loaded is the 409 that
 * offers a reload. Reading in that order is what makes it sound. Anything
 * committed in between either changed this file, which the sha catches, or did
 * not, in which case the commit is refused for a moved head and the whole
 * check runs again against the new one.
 *
 * A 404 is the other interesting answer. It means the page moved while this was
 * being written, so the forwarding record is consulted and the same commit is
 * aimed at wherever it went. A pure move keeps the blob sha, since a git blob
 * does not know its own path, so the stale-write check still passes and the
 * writer never finds out. A move that also renamed the page changed its
 * frontmatter, so the sha differs and they get the conflict they should.
 */
export async function commitFile(save: SaveRequest, additions: Addition[] = []): Promise<Result<SaveResponse>> {
  const config = readConfig();
  if (!config.ok) return config;

  let target = save.path;

  for (let attempt = 0; attempt < HEAD_RETRIES; attempt++) {
    const head = await readBranchHead(config.value);
    if (!head.ok) return head;

    const current = await readSource(target);
    if (!current.ok) {
      if (current.failure.status !== 404) return current;

      const followed = await followMove(target);
      if (!followed.ok) return followed;
      if (!followed.value) return current;

      target = followed.value;
      continue;
    }

    const refusal = pageWriteRefusal(target, current.value.text);
    if (refusal) return { ok: false, failure: { status: 403, error: refusal } };

    if (current.value.sha !== save.sha) {
      return {
        ok: false,
        failure: {
          status: 409,
          error: "This file changed on GitHub since you opened it.",
          conflict: { theirs: current.value.sha, ours: save.sha },
        },
      };
    }

    const written = await commitTree({
      message: save.message,
      additions: [...additions, { path: target, content: save.text }],
      author: save.author,
      expectedHead: head.value,
      blobFor: target,
    });
    if (!written.ok) return written;

    if (!written.value.moved) {
      return {
        ok: true,
        value: { commitSha: written.value.commitSha, sha: written.value.blobSha ?? save.sha },
      };
    }
  }

  return {
    ok: false,
    failure: {
      status: 409,
      error: `${config.value.branch} kept moving while this was being saved. Your text is still here, so press Save again.`,
    },
  };
}

/**
 * Follows a page that moved out from under somebody who was editing it.
 *
 * The alternative was refusing the save, which would have been correct and
 * useless: the words are already written, and the page they belong to still
 * exists, just at a different address. So a 404 on a path the forwarding record
 * knows about is answered by aiming the same commit at where the page went.
 *
 * Null means it was deleted rather than moved, or was never there at all, which
 * is the case that does have to be reported.
 *
 * The chain is walked because a page can move twice while one editor is open.
 */
async function followMove(path: string): Promise<Result<string | null>> {
  const record = await readSource(MOVED_FILE);
  if (!record.ok) return record.failure.status === 404 ? { ok: true, value: null } : record;

  try {
    const parsed: unknown = JSON.parse(record.value.text);
    return { ok: true, value: Array.isArray(parsed) ? finalHome(parsed as Move[], path) : null };
  } catch {
    return { ok: true, value: null };
  }
}

/**
 * Commits an upload, whose `path` the caller has already named after its bytes.
 *
 * The name being a hash of the contents is what makes the existence check the
 * whole of the work: a file already sitting at that path holds these very
 * bytes, so the upload is done and no commit is worth making. Dropping the same
 * image into a second page therefore costs one read and no rebuild.
 */
export async function commitAsset(asset: AssetUpload): Promise<Result<AssetResponse>> {
  const config = readConfig();
  if (!config.ok) return config;

  const landed: AssetResponse = { path: asset.path, url: asset.url };

  const already = await fileExists(config.value, asset.path);
  if (!already.ok) return already;
  if (already.value) return { ok: true, value: landed };

  const head = await readBranchHead(config.value);
  if (!head.ok) return head;

  const written = await commitTree({
    message: asset.message,
    additions: [{ path: asset.path, content: asset.bytes }],
    author: asset.author,
    expectedHead: head.value,
  });
  if (!written.ok) return written;

  if (written.value.moved) {
    return {
      ok: false,
      failure: { status: 409, error: "Somebody else committed mid-upload. Try the upload again." },
    };
  }

  return { ok: true, value: landed };
}

/** Whether a path is on the branch, without pulling its bytes down. */
async function fileExists(config: Config, path: string): Promise<Result<boolean>> {
  const call = await attempt(
    () =>
      github(`${contentsUrl(config, path)}?ref=${encodeURIComponent(config.branch)}`, {
        method: "HEAD",
        headers: githubHeaders(config.token),
      }),
    UNREACHABLE,
  );
  if (!call.ok) return call;

  if (call.value.ok) return { ok: true, value: true };
  if (call.value.status === 404) return { ok: true, value: false };

  return { ok: false, failure: describeWriteFailure(call.value.status, "") };
}

/**
 * Credits the human, since `createCommitOnBranch` insists the token is author.
 *
 * @example coAuthoredBy({ name: "Ada", email: "ada@x.dk" }); // "Co-authored-by: Ada <ada@x.dk>"
 */
function coAuthoredBy(author: { name: string; email: string }) {
  return `Co-authored-by: ${author.name} <${author.email}>`;
}

/** GraphQL takes every file as base64, whichever way the bytes reached us. */
function base64(content: string | Uint8Array) {
  return typeof content === "string"
    ? Buffer.from(content, "utf8").toString("base64")
    : Buffer.from(content).toString("base64");
}

/** A GraphQL answer: the data, or the news that `expectedHeadOid` was stale. */
type Answered<T> = { moved: true } | { moved: false; data: T };

/**
 * Posts one GraphQL operation and sorts its three ways of failing.
 *
 * GraphQL answers 200 with an `errors` array, so a refusal looks like a success
 * to `response.ok` and has to be read out of the body. The transport can still
 * fail on its own with a real status, which is the third case.
 */
async function graphql<T>(
  config: Config,
  query: string,
  variables: Record<string, unknown>,
): Promise<Result<Answered<T>>> {
  const call = await attempt(
    () =>
      github(GRAPHQL_URL, {
        method: "POST",
        headers: { ...githubHeaders(config.token), "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      }),
    {
      status: 504,
      error:
        "GitHub did not answer, so this edit may or may not have been committed. Copy your text, then reload to see which.",
    },
  );
  if (!call.ok) return call;
  const response = call.value;

  if (!response.ok) {
    return { ok: false, failure: describeWriteFailure(response.status, await readMessage(response)) };
  }

  const body = await attempt(() => response.json() as Promise<{ data?: T; errors?: GraphqlError[] }>, {
    status: 502,
    error: "GitHub answered the commit unreadably. Reload to see whether it landed.",
  });
  if (!body.ok) return body;

  const errors = body.value.errors ?? [];
  if (errors.length > 0) {
    return headMoved(errors)
      ? { ok: true, value: { moved: true } }
      : { ok: false, failure: describeGraphqlFailure(errors) };
  }

  return body.value.data
    ? { ok: true, value: { moved: false, data: body.value.data } }
    : { ok: false, failure: { status: 502, error: "GitHub answered the commit with nothing in it." } };
}

type GraphqlError = { type?: string; message?: string };

/**
 * Whether GitHub is saying the branch tip moved under `expectedHeadOid`.
 *
 * Matched two ways because neither is guaranteed on its own: the machine-
 * readable `STALE_DATA` is what GitHub documents, and the sentence is what it
 * has actually been sending. Being wrong here is cheap in one direction only,
 * so a miss costs a needless conflict message and never a lost commit.
 */
function headMoved(errors: GraphqlError[]) {
  return errors.some(
    ({ type, message }) =>
      type === "STALE_DATA" || /expected .*(?:oid|head|branch)|but it did not/i.test(message ?? ""),
  );
}

/** Turns a GraphQL `errors` array into the one sentence worth showing. */
function describeGraphqlFailure(errors: GraphqlError[]): Failure {
  const message = errors
    .map(({ message }) => message)
    .filter(Boolean)
    .join("; ");

  if (errors.some(({ type }) => type === "FORBIDDEN" || type === "NOT_FOUND")) {
    return {
      status: 403,
      error: `GitHub rejected the commit: ${message}. Your GitHub account most likely lacks write access to this repository.`,
    };
  }

  if (/protected branch|branch protection|required status/i.test(message)) {
    return {
      status: 405,
      error: `The branch is protected, so the studio cannot commit to it: ${message}. Pin the project to an unprotected branch, or allow editors to bypass the rule.`,
    };
  }

  return { status: 502, error: `GitHub rejected the commit: ${message}` };
}

/**
 * Runs a call that talks to the network, turning a throw into a `Failure`.
 *
 * Everything in this module reports problems as a `Result`, and `fetch` and
 * `Response.json` are the two things here that raise instead. Letting one
 * escape would surface as a bare 500 with nothing useful in it.
 */
async function attempt<T>(call: () => Promise<T>, failure: Failure): Promise<Result<T>> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false, failure };
  }
}

/**
 * The sha a ref points at, or null when it does not exist.
 *
 * Asked with the last answer's ETag, so a ref that has not moved since costs no
 * rate limit.
 */
async function readRefTarget(config: Config, ref: string): Promise<Result<string | null>> {
  const call = await attempt(
    () =>
      fetchRemembered(refUrl(config, ref), {
        headers: githubHeaders(config.token),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      }),
    UNREACHABLE,
  );
  if (!call.ok) return call;
  const response = call.value;

  if (response.status === 404) {
    return { ok: true, value: null };
  }
  if (!response.ok) {
    return {
      ok: false,
      failure: describeRefFailure(response.status, await readMessage(response)),
    };
  }

  const target = await attempt(() => response.json() as Promise<{ object?: { sha?: unknown } }>, UNREADABLE_REF);
  if (!target.ok) return target;

  const sha = target.value.object?.sha;
  return typeof sha === "string" ? { ok: true, value: sha } : { ok: false, failure: UNREADABLE_REF };
}

type Config = { token: string; owner: string; repo: string; subfolder: string; branch: string };

/**
 * A doc's address on the contents API, counted from the repository root.
 *
 * The one place a site path becomes a repository path for a read. Every caller
 * passes the site-relative path it already had, so a site in a subfolder needs
 * no caller to know it is in one.
 */
function contentsUrl({ owner, repo, subfolder }: Config, path: string) {
  const at = encodePath(repoPath(path, subfolder));
  return `https://api.github.com/repos/${owner}/${repo}/contents/${at}`;
}

function gitUrl({ owner, repo }: Config) {
  return `https://api.github.com/repos/${owner}/${repo}/git`;
}

/**
 * Where one ref is read, which is `git/ref`, singular, with its own leading `refs/` dropped.
 *
 * @example refUrl(config, "refs/heads/main"); // ".../git/ref/heads/main"
 */
function refUrl(config: Config, ref: string) {
  return `${gitUrl(config)}/ref/${encodePath(ref.replace(/^refs\//, ""))}`;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function githubHeaders(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": API_VERSION,
  };
}

/**
 * `fetch` against GitHub, with a deadline.
 *
 * Bare `fetch` has none, so a GitHub call that hangs holds the function open
 * until Vercel's own ceiling on a function, which is measured in minutes.
 * Somebody is watching a spinner the whole time, and a save that has not landed
 * in ten seconds is not going to. Aborting throws, which `attempt` already
 * reports as the same 504 as a refused connection, so the caller needs no
 * separate branch for it.
 *
 * Ten rather than the ceiling itself, because a save is three calls: the head,
 * the file's sha, then the commit. Two of them can stall and our own message
 * still reaches the browser ahead of Vercel killing the function, which says
 * nothing useful. Ten is generous for all three: the slowest is the commit
 * carrying a 4 MB upload as base64, and the rest are single reads that return
 * in well under a second.
 *
 * @example github(GRAPHQL_URL, { method: "POST", body }); // Promise<Response>
 */
function github(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });
}

/**
 * The repository, branch and token this editing request works with.
 *
 * The editing route pins them for the length of the request, from the project
 * in its URL and the editor's own session. Called outside that route there is
 * nothing to write to, which is a bug in the caller rather than a user error.
 */
function readConfig(): Result<Config> {
  const scoped = editingContext.getStore();
  if (!scoped) {
    return { ok: false, failure: { status: 500, error: "This request is not tied to a project." } };
  }

  const { owner, repo, subfolder, branch } = scoped.remote;
  return { ok: true, value: { token: scoped.session.token, owner, repo, subfolder, branch } };
}

/**
 * Where the pinned project keeps its uploads, as its config named it when the request was pinned.
 *
 * @example await uploadsFolder(); // "docs/_uploads"
 */
export async function uploadsFolder() {
  const scoped = editingContext.getStore();
  if (!scoped) throw new Error("This request is not tied to a project.");
  return scoped.remote.uploads;
}

/** GitHub base64 arrives line-wrapped, and docs contain characters like `·`. */
function decodeContent(content: string) {
  return Buffer.from(content.replace(/\s+/g, ""), "base64").toString("utf8");
}

/** Pulls GitHub's `message` out of an error body, falling back to raw text. */
async function readMessage(response: Response) {
  const text = await response.text();

  try {
    const body = JSON.parse(text) as { message?: string };
    return body.message ?? text;
  } catch {
    return text;
  }
}

/**
 * Turns a write call that came back with an HTTP status into a `Failure`.
 *
 * The write itself is GraphQL, which answers 200 and puts its refusals in the
 * body, so everything reaching here is the transport underneath: a bad token,
 * a revoked permission, a rate limit. A stale sha and branch protection are
 * handled where they now surface, in `commitFile` and `describeGraphqlFailure`.
 */
/**
 * A content folder the branch does not have, which is a misconfigured site.
 *
 * Named separately from the token failures because the cause is different and
 * the fix is in a file rather than in GitHub's settings: on a site kept in a
 * subfolder this is what a missing or misspelt `content` in `.jotdown/config.json`
 * looks like, and the token diagnostic would send somebody hunting through
 * permissions for it.
 */
function missingContentRoot(at: string): Failure {
  return {
    status: 404,
    error: `This repository has no ${at}/ on the branch. Check the content folder in .jotdown/config.json.`,
  };
}

function describeWriteFailure(status: number, message: string): Failure {
  if (status === 401 || status === 403 || status === 404) {
    return {
      status: 403,
      error: `GitHub rejected the commit (${status}): ${message}. Your GitHub account most likely lacks write access to this repository.`,
    };
  }

  return { status: 502, error: `GitHub rejected the commit (${status}): ${message}` };
}

/**
 * What GitHub refusing to read a ref means for the reader.
 *
 * A 403 or 404 on a branch the studio just opened means the token lost access,
 * which is worth saying plainly rather than as "GitHub said no".
 */
function describeRefFailure(status: number, message: string): Failure {
  if (status === 403 || status === 404) {
    return {
      status: 403,
      error: `GitHub would not read the branch (${status}): ${message}. Your GitHub account most likely lacks access to this repository.`,
    };
  }

  return { status: 502, error: `GitHub would not read the branch (${status}): ${message}` };
}

/** Lists page commits from a fixed branch snapshot, preserving GitHub's ordering. */
export async function listPageHistory(path: string, page: number, head?: string): Promise<Result<PageHistoryResponse>> {
  const config = readConfig();
  if (!config.ok) return config;
  const starting = head ? { ok: true as const, value: head } : await readBranchHead(config.value);
  if (!starting.ok) return starting;

  const { owner, repo, token } = config.value;
  const query = new URLSearchParams({
    sha: starting.value,
    path: repoPath(path, config.value.subfolder),
    per_page: String(HISTORY_PAGE_SIZE),
    page: String(page),
  });
  const call = await attempt(
    () =>
      github(`https://api.github.com/repos/${owner}/${repo}/commits?${query}`, {
        headers: githubHeaders(token),
      }),
    UNREACHABLE,
  );
  if (!call.ok) return call;
  if (!call.value.ok)
    return { ok: false, failure: { status: 502, error: `GitHub could not read page history (${call.value.status}).` } };

  const parsed = await attempt(
    async () => {
      const commits = (await call.value.json()) as {
        sha: string;
        commit: { message: string; author: { name: string; email: string; date: string } | null };
      }[];
      return commits.map(({ sha, commit }) => ({
        sha,
        subject: commit.message.split("\n")[0] ?? "",
        authoredAt: commit.author?.date ?? "",
        authors: revisionAuthors(commit.message, {
          name: commit.author?.name ?? "Unknown author",
          email: commit.author?.email ?? "",
        }),
      }));
    },
    { status: 502, error: "GitHub returned unreadable page history." },
  );
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    value: {
      head: starting.value,
      revisions: parsed.value,
      nextPage: /rel="next"/.test(call.value.headers.get("link") ?? "") ? page + 1 : null,
    },
  };
}

/** Reads raw Markdown at a commit without compiling or reserializing it. */
export async function readRevision(path: string, sha: string): Promise<Result<PageRevisionResponse>> {
  const config = readConfig();
  if (!config.ok) return config;
  const call = await attempt(
    () =>
      github(`${contentsUrl(config.value, path)}?ref=${sha}`, {
        headers: githubHeaders(config.value.token),
      }),
    UNREACHABLE,
  );
  if (!call.ok) return call;
  if (call.value.status === 404) return { ok: true, value: { path, sha, text: null } };
  if (!call.value.ok)
    return { ok: false, failure: { status: 502, error: `GitHub could not read this version (${call.value.status}).` } };

  const parsed = await attempt(
    () => call.value.json() as Promise<{ encoding?: string; content?: string; size?: number }>,
    { status: 502, error: "GitHub returned an unreadable version." },
  );
  if (!parsed.ok) return parsed;
  const file = parsed.value;
  if (file.encoding !== "base64" || typeof file.content !== "string" || (file.size ?? 0) > MAX_REVISION_BYTES) {
    return { ok: false, failure: { status: 422, error: "This version is too large or is not a Markdown file." } };
  }
  const decoded = revisionText(Buffer.from(file.content, "base64"));
  return decoded.ok ? { ok: true, value: { path, sha, text: decoded.value } } : decoded;
}
