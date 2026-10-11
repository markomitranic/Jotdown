/**
 * What replaces the contents API's per-file precondition.
 *
 * `createCommitOnBranch` guards the branch tip and nothing else, so a save that
 * used to be protected by sending a blob sha is now protected by reading one
 * first. These cases are the reason to believe that swap kept its promises: a
 * colleague's words are never overwritten, and a colleague's unrelated commit
 * never reads as a conflict.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { repoPath } from "@jotdown/core/lib/paths";

vi.mock("./context", async () => (await import("./test-project")).testEditing);

const { commitFile } = await import("./editing");

const save = {
  path: "docs/architecture/index.mdx",
  text: "# New words",
  sha: "blob-as-loaded",
  message: "Edit architecture",
  author: { name: "Ada", email: "ada@example.com" },
};

/** One reply per call, in order, plus a log of what was asked for. */
function stubGitHub(replies: unknown[]) {
  const asked: { url: string; body: unknown }[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const reply = replies.shift() ?? { status: 500, json: {} };
    const { status = 200, json } = reply as { status?: number; json: unknown };
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return asked;
}

const head = (sha: string) => ({ json: { object: { sha } } });
const blob = (sha: string) => ({
  json: { sha, encoding: "base64", content: Buffer.from("# Old words").toString("base64") },
});
const committed = (oid: string, fileOid: string) => ({
  json: { data: { createCommitOnBranch: { commit: { oid, file: { oid: fileOid } } } } },
});
const branchMoved = {
  json: { errors: [{ type: "STALE_DATA", message: "Expected branch to point to X but it did not." }] },
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("commitFile", () => {
  test("refuses a save that removes the generated flag", async () => {
    const asked = stubGitHub([
      head("head1"),
      {
        json: {
          sha: save.sha,
          encoding: "base64",
          content: Buffer.from("---\ngenerated: true\n---\n# API").toString("base64"),
        },
      },
    ]);
    const result = await commitFile(save);
    expect(result).toMatchObject({ ok: false, failure: { status: 403 } });
    expect(asked).toHaveLength(2);
  });

  test("commits when the loaded sha is still the one on the branch", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-as-loaded"), committed("commit1", "blob-new")]);

    const result = await commitFile(save);

    expect(result).toEqual({ ok: true, value: { commitSha: "commit1", sha: "blob-new" } });
    expect(asked[2]!.url).toBe("https://api.github.com/graphql");
  });

  test("commits drawing assets and their page in one mutation", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-as-loaded"), committed("commit1", "blob-new")]);
    const additions = [
      { path: "docs/_uploads/whiteboards/drawing.excalidraw", content: '{"type":"excalidraw"}' },
      { path: "docs/_uploads/whiteboards/drawing.png", content: new Uint8Array([137, 80, 78, 71]) },
    ];

    const result = await commitFile(save, additions);

    expect(result.ok).toBe(true);
    expect(asked).toHaveLength(3);
    expect(asked[2]!.body).toMatchObject({
      variables: {
        input: {
          expectedHeadOid: "head1",
          fileChanges: {
            additions: [...additions, { path: save.path, content: save.text }].map(({ path, content }) => ({
              path: repoPath(path, ""),
              contents: Buffer.from(content).toString("base64"),
            })),
          },
        },
      },
    });
  });

  test("reads the head before the blob, so a commit in between cannot slip past", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-as-loaded"), committed("commit1", "blob-new")]);

    await commitFile(save);

    expect(asked[0]!.url).toContain("/git/ref/heads/main");
    expect(asked[1]!.url).toContain(`/contents/${repoPath(save.path, "")}`);
  });

  test("refuses a stale write before making any commit", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-somebody-else-wrote")]);

    const result = await commitFile(save);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure).toMatchObject({
      status: 409,
      conflict: { theirs: "blob-somebody-else-wrote", ours: "blob-as-loaded" },
    });
    expect(asked.some(({ url }) => url.includes("graphql"))).toBe(false);
  });

  test("retries against the new head when somebody else committed elsewhere", async () => {
    stubGitHub([
      head("head1"),
      blob("blob-as-loaded"),
      branchMoved,
      head("head2"),
      blob("blob-as-loaded"),
      committed("commit2", "blob-new"),
    ]);

    const result = await commitFile(save);

    expect(result).toEqual({ ok: true, value: { commitSha: "commit2", sha: "blob-new" } });
  });

  test("gives up rather than looping when the branch will not settle", async () => {
    stubGitHub([
      head("head1"),
      blob("blob-as-loaded"),
      branchMoved,
      head("head2"),
      blob("blob-as-loaded"),
      branchMoved,
      head("head3"),
      blob("blob-as-loaded"),
      branchMoved,
    ]);

    const result = await commitFile(save);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.status).toBe(409);
  });

  test("names the human in a trailer, since GitHub owns the author", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-as-loaded"), committed("commit1", "blob-new")]);

    await commitFile(save);

    const { variables } = asked[2]!.body as { variables: { input: { message: { headline: string; body: string } } } };
    const { input } = variables;
    expect(input.message.headline).toBe("Edit architecture");
    expect(input.message.body).toBe("Co-authored-by: Ada <ada@example.com>");
  });

  test("sends the text as base64 against the head it checked", async () => {
    const asked = stubGitHub([head("head1"), blob("blob-as-loaded"), committed("commit1", "blob-new")]);

    await commitFile(save);

    const { variables } = asked[2]!.body as {
      variables: {
        input: { expectedHeadOid: string; fileChanges: { additions: { path: string; contents: string }[] } };
      };
    };
    const { input } = variables;
    expect(input.expectedHeadOid).toBe("head1");
    expect(input.fileChanges.additions).toEqual([
      { path: repoPath(save.path, ""), contents: Buffer.from(save.text).toString("base64") },
    ]);
  });
});
