import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Result } from "../../live-edit/_contract";
import { HISTORY_PAGE_SIZE, MAX_REVISION_BYTES, revisionAuthors, revisionText } from "../../live-edit/_history";
import type { PageHistoryResponse, PageRevisionResponse } from "@jotdown/editor/types";

const execute = promisify(execFile);

/** Runs one bounded git read in the project folder, arguments passed as they are and never through a shell. */
function git(directory: string, args: string[]) {
  return execute("git", args, { cwd: directory, encoding: "buffer", maxBuffer: 2_000_000, timeout: 10_000 });
}

/**
 * A page's commits in the folder's git history, newest first, pinned to the commit the first page was read at.
 *
 * A folder outside git, or a page git has never seen, has no history, which
 * reads as an empty list rather than an error.
 *
 * @example await listPageHistory("/work/handbook", "docs/index.mdx", 1); // { ok: true, value: { head, revisions, nextPage } }
 */
export async function listPageHistory(
  directory: string,
  path: string,
  page: number,
  head?: string,
): Promise<Result<PageHistoryResponse>> {
  const starting =
    head ??
    (await git(directory, ["rev-parse", "HEAD"])
      .then(({ stdout }) => stdout.toString().trim())
      .catch(() => null));
  if (!starting) return { ok: true, value: { head: "", revisions: [], nextPage: null } };

  try {
    const { stdout } = await git(directory, [
      "log",
      starting,
      "--format=%H%x00%aI%x00%an%x00%ae%x00%B%x00",
      `--max-count=${HISTORY_PAGE_SIZE + 1}`,
      `--skip=${(page - 1) * HISTORY_PAGE_SIZE}`,
      "--",
      path,
    ]);

    const fields = stdout.toString().split("\0");
    const revisions: PageHistoryResponse["revisions"] = [];
    for (let at = 0; at + 4 < fields.length; at += 5) {
      const [sha = "", authoredAt = "", name = "", email = "", message = ""] = fields.slice(at, at + 5);
      revisions.push({
        sha: sha.trim(),
        authoredAt,
        subject: message.split("\n")[0] ?? "",
        authors: revisionAuthors(message, { name, email }),
      });
    }

    return {
      ok: true,
      value: {
        head: starting,
        revisions: revisions.slice(0, HISTORY_PAGE_SIZE),
        nextPage: revisions.length > HISTORY_PAGE_SIZE ? page + 1 : null,
      },
    };
  } catch {
    return { ok: false, failure: { status: 502, error: "Could not read this folder's git history." } };
  }
}

/**
 * A page's Markdown at one commit of the folder's git history, or null text when the page did not exist then.
 *
 * @example await readRevision("/work/handbook", "docs/index.mdx", sha); // { ok: true, value: { path, sha, text: "# Handbook…" } }
 */
export async function readRevision(
  directory: string,
  path: string,
  sha: string,
): Promise<Result<PageRevisionResponse>> {
  try {
    const prefix = (await git(directory, ["rev-parse", "--show-prefix"])).stdout.toString().trim();
    await git(directory, ["cat-file", "-e", `${sha}^{commit}`]);

    const { stdout: entry } = await git(directory, ["ls-tree", "-l", sha, "--", path]);
    if (entry.length === 0) return { ok: true, value: { path, sha, text: null } };

    const size = entry.toString().match(/^100\d{3} blob [a-f0-9]+\s+(\d+)\t/);
    if (!size || Number(size[1]) > MAX_REVISION_BYTES) {
      return { ok: false, failure: { status: 422, error: "This version is too large or is not a Markdown file." } };
    }

    const { stdout } = await git(directory, ["show", `${sha}:${prefix}${path}`]);
    const decoded = revisionText(stdout);
    return decoded.ok ? { ok: true, value: { path, sha, text: decoded.value } } : decoded;
  } catch {
    return { ok: false, failure: { status: 502, error: "Could not read this version from the folder's git history." } };
  }
}
