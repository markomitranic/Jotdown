/**
 * How the arranger finds the pages it is about to move.
 *
 * The listing asks GitHub for the content folder, not for the branch root, and
 * the paths it gets back are relative to the folder it asked for. Both halves
 * have to agree: an unrebased path matches no allowlist and the arranger opens
 * on an empty tree, which looks like a broken editor rather than a bug.
 */

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("./context", async () => (await import("./test-project")).testEditing);

const { readDocs } = await import("./editing");
const { repoPath } = await import("@jotdown/core/lib/paths");

/** One reply per call, in order, plus a log of the URLs asked for. */
function stubGitHub(replies: ({ status?: number; json: unknown } | { text: string })[]) {
  const asked: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    asked.push(String(input));
    const reply = replies.shift() ?? { status: 500, json: {} };
    if ("text" in reply) return new Response(reply.text);
    const { status = 200, json } = reply;
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return asked;
}

const head = { json: { object: { sha: "head-sha" } } };

/** A tree listing as GitHub spells it: every path relative to the folder asked for. */
const listing = {
  json: {
    tree: [
      { path: "index.mdx", type: "blob", sha: "blob-0" },
      { path: "meta.json", type: "blob", sha: "blob-1" },
      { path: "architecture", type: "tree", sha: "tree-0" },
      { path: "architecture/bff.mdx", type: "blob", sha: "blob-2" },
      { path: "package.json", type: "blob", sha: "blob-3" },
    ],
  },
};

const blobs = {
  json: { data: { repository: { b0: { text: "home" }, b1: { text: "{}" }, b2: { text: "bff" } } } },
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("readDocs", () => {
  test("asks for the content folder rather than the whole branch", async () => {
    const asked = stubGitHub([head, listing, blobs]);
    await readDocs();

    expect(asked[1]).toContain(`/git/trees/head-sha:${repoPath("docs", "")}?recursive=1`);
  });

  test("puts the content root back on every path it read", async () => {
    stubGitHub([head, listing, blobs]);
    const docs = await readDocs();

    expect(docs.ok).toBe(true);
    if (!docs.ok) return;
    expect([...docs.value.corpus.keys()]).toEqual(["docs/index.mdx", "docs/meta.json", "docs/architecture/bff.mdx"]);
  });

  test("reads a page GraphQL cut short again in full, so a move never writes half of it back", async () => {
    const cut = {
      json: {
        data: {
          repository: { b0: { text: "home" }, b1: { text: "{}" }, b2: { text: "the first half", isTruncated: true } },
        },
      },
    };
    const asked = stubGitHub([head, listing, cut, { text: "the first half and the rest" }]);
    const docs = await readDocs();

    expect(asked[3]).toContain("/git/blobs/blob-2");
    expect(docs.ok && docs.value.corpus.get("docs/architecture/bff.mdx")).toBe("the first half and the rest");
  });

  test("says which folder is missing when the branch has no content root", async () => {
    stubGitHub([head, { status: 404, json: { message: "Not Found" } }]);
    const docs = await readDocs();

    expect(docs.ok).toBe(false);
    if (docs.ok) return;
    expect(docs.failure.status).toBe(404);
    expect(docs.failure.error).toContain("no docs/");
  });
});
