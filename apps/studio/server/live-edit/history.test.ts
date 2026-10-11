import { beforeEach, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({ listPageHistory: vi.fn(), readRevision: vi.fn(), readSource: vi.fn() }));
vi.mock("../storage", () => ({ storage: store }));
const { GET: history } = await import("./history");
const { GET: revision } = await import("./revision");
const sha = "a".repeat(40);

beforeEach(() => vi.resetAllMocks());

test("rejects invalid paths, commit IDs and unpinned pagination before repository access", async () => {
  for (const query of ["path=../secrets.mdx", "path=docs/page.mdx&page=0", "path=docs/page.mdx&page=2"]) {
    expect((await history(new Request(`http://localhost/history?${query}`))).status).toBe(400);
  }
  for (const query of [`path=../secrets.mdx&sha=${sha}`, "path=docs/page.mdx&sha=HEAD"]) {
    expect((await revision(new Request(`http://localhost/revision?${query}`))).status).toBe(400);
  }
  expect(store.listPageHistory).not.toHaveBeenCalled();
  expect(store.readRevision).not.toHaveBeenCalled();
});

test("returns current source only on the first page and disables response caching", async () => {
  const value = { head: sha, revisions: [], nextPage: 2 };
  const source = { path: "docs/page.mdx", text: "# Current", sha: "blob" };
  store.listPageHistory.mockResolvedValue({ ok: true, value });
  store.readSource.mockResolvedValue({ ok: true, value: source });
  const first = await history(new Request("http://localhost/history?path=docs/page.mdx"));
  expect(await first.json()).toEqual({ ...value, current: source });
  expect(first.headers.get("cache-control")).toBe("private, no-store");
  const second = await history(new Request(`http://localhost/history?path=docs/page.mdx&page=2&head=${sha}`));
  expect(await second.json()).toEqual(value);
  expect(store.readSource).toHaveBeenCalledOnce();
  expect(store.listPageHistory).toHaveBeenLastCalledWith("docs/page.mdx", 2, sha);
});
