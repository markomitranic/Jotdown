import { beforeEach, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({ readDocs: vi.fn(), readSource: vi.fn(), commitTree: vi.fn() }));
vi.mock("../storage", () => ({ storage: store }));
const { POST: structure } = await import("./structure");

beforeEach(() => vi.resetAllMocks());

const author = { name: "Ada", email: "ada@example.com" };
const create = (extra: Record<string, unknown>) =>
  new Request("http://localhost/structure", {
    method: "POST",
    body: JSON.stringify({ ops: [{ kind: "create", path: "docs/hi.mdx", title: "Hi", ...extra }], author }),
  });

test("refuses extra front matter a new page cannot be written with, before reading the project", async () => {
  for (const data of [
    { title: "Again" },
    { unlisted: false },
    { "bad key": "x" },
    { nested: { a: 1 } },
    { list: [1] },
    "date: today",
  ]) {
    expect((await structure(create({ data }))).status).toBe(400);
  }
  expect((await structure(create({ body: 42 }))).status).toBe(400);
  expect(store.readDocs).not.toHaveBeenCalled();
});
