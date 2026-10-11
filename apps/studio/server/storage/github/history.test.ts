import { afterEach, describe, expect, test, vi } from "vitest";
import { parseHistory, parseRevision, revisionAuthors, revisionText } from "../../live-edit/_history";
import { listPageHistory, readRevision } from "./editing";
import { repoPath } from "@jotdown/core/lib/paths";

vi.mock("./context", async () => (await import("./test-project")).testEditing);

const sha = "a".repeat(40);
const person = { name: "Service account", email: "bot@example.com" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("history inputs and source", () => {
  test("requires bounded pages and pins subsequent pages to a full commit ID", () => {
    expect(parseHistory(new URLSearchParams())).toEqual({ ok: true, value: { page: 1, head: undefined } });
    for (const page of ["0", "-1", "1.5", "10000", "1junk"]) {
      expect(parseHistory(new URLSearchParams({ page })).ok).toBe(false);
    }
    expect(parseHistory(new URLSearchParams({ page: "2" })).ok).toBe(false);
    expect(parseHistory(new URLSearchParams({ page: "2", head: sha })).ok).toBe(true);
    expect(parseRevision("HEAD~1").ok).toBe(false);
    expect(parseRevision(`${sha}:docs/file.mdx`).ok).toBe(false);
  });

  test("credits human coauthors and keeps their email addresses", () => {
    expect(
      revisionAuthors(
        "Edit\n\nCo-authored-by: Ada Lovelace <ada@example.com>\nCo-authored-by: Ada Lovelace <ADA@example.com>\n",
        person,
      ),
    ).toEqual([{ name: "Ada Lovelace", email: "ada@example.com" }]);
    expect(revisionAuthors("Ordinary Git edit", person)).toEqual([person]);
  });

  test("preserves UTF-8, BOM and CRLF while rejecting binary, invalid UTF-8 and oversized text", () => {
    const source = "\uFEFF# Æble\r\n<Widget value={1} />\r\n";
    expect(revisionText(Buffer.from(source))).toEqual({ ok: true, value: source });
    for (const bytes of [Buffer.from([255]), Buffer.from("a\0b"), Buffer.alloc(1_000_001, 65)]) {
      expect(revisionText(bytes).ok).toBe(false);
    }
  });
});

/** Sets repository credentials and deterministic GitHub responses for adapter tests. */
function github(replies: Response[]) {
  const fetch = vi.fn(
    async (_url: string, _init?: RequestInit) => replies.shift() ?? new Response(null, { status: 500 }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("GitHub history", () => {
  test("uses the pinned SHA, repository path and pagination link", async () => {
    const fetch = github([
      Response.json(
        [
          {
            sha,
            commit: {
              message: "Update title\n\nCo-authored-by: Ada <ada@example.com>",
              author: { ...person, date: "2026-09-18T10:00:00Z" },
            },
          },
        ],
        { headers: { link: '<https://api.github.com/next>; rel="next"' } },
      ),
    ]);
    const result = await listPageHistory("docs/index.mdx", 2, sha);
    expect(result).toMatchObject({
      ok: true,
      value: {
        head: sha,
        nextPage: 3,
        revisions: [{ subject: "Update title", authors: [{ name: "Ada", email: "ada@example.com" }] }],
      },
    });
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sha,
      path: repoPath("docs/index.mdx", ""),
      per_page: "30",
      page: "2",
    });
  });

  test("resolves the branch once for the first history page", async () => {
    const fetch = github([Response.json({ object: { sha } }), Response.json([])]);
    expect(await listPageHistory("docs/index.mdx", 1)).toMatchObject({
      ok: true,
      value: { head: sha, revisions: [], nextPage: null },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]![0])).toContain(`sha=${sha}`);
  });

  test("reads raw historical MDX and represents missing versions without restoring empty text", async () => {
    const text = 'import Old from "./missing";\r\n\r\n<Old />\r\n';
    github([
      Response.json({ content: Buffer.from(text).toString("base64"), encoding: "base64" }),
      new Response(null, { status: 404 }),
    ]);
    expect(await readRevision("docs/index.mdx", sha)).toEqual({
      ok: true,
      value: { path: "docs/index.mdx", sha, text },
    });
    expect(await readRevision("docs/index.mdx", sha)).toMatchObject({ ok: true, value: { text: null } });
  });

  test("reports GitHub failures and oversized files", async () => {
    github([new Response(null, { status: 403 }), Response.json({ encoding: "none" })]);
    expect(await listPageHistory("docs/index.mdx", 1, sha)).toMatchObject({ ok: false, failure: { status: 502 } });
    expect(await readRevision("docs/index.mdx", sha)).toMatchObject({ ok: false, failure: { status: 422 } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await readRevision("docs/index.mdx", sha)).toMatchObject({ ok: false, failure: { status: 504 } });
  });
});
