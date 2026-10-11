/**
 * Rearranging pages without breaking the links between them.
 *
 * A relative link is resolved against the page tree when the page renders, and
 * a link whose target is missing is handed to the browser exactly as written,
 * so a stale path is a 404 nobody is told about. These cases are the reason to
 * believe a reader can drag things around without leaving one behind.
 */

import { describe, expect, test } from "vitest";
import { applyOps, setField } from "./_structure";
import { docUrl, linkIn, linkOf, relativeTo, resolve, slugify } from "@jotdown/core/lib/paths";

const page = (title: string, body = "") => `---\ntitle: ${title}\ndescription: A page.\n---\n\n${body}`;

const corpus = () =>
  new Map([
    ["docs/index.mdx", page("Home", "See [architecture](./architecture/index.mdx).\n")],
    ["docs/meta.json", '{\n  "title": "Handbook",\n  "pages": ["index", "architecture", "tooling", "..."]\n}\n'],
    ["docs/architecture/index.mdx", page("Architecture", "Read [the BFF page](./bff.mdx).\n")],
    ["docs/architecture/bff.mdx", page("BFF", "Back to [home](../index.mdx).\n")],
    ["docs/architecture/meta.json", '{ "title": "Architecture", "defaultOpen": true, "pages": ["bff", "..."] }\n'],
    ["docs/tooling/index.mdx", page("Tooling", "The [BFF page](../architecture/bff.mdx) covers it.\n")],
    ["docs/tooling/meta.json", '{ "title": "Tooling" }\n'],
  ]);

/** The `pages` a plan would commit for one folder, or null if it leaves it alone. */
function pagesIn(plan: { additions: { path: string; content: string }[] }, folder: string) {
  const text = written(plan, `${folder}/meta.json`);
  return text === undefined ? null : ((JSON.parse(text) as { pages?: string[] }).pages ?? null);
}

/** The text a plan would commit for one path, or undefined if it leaves it alone. */
function written(plan: { additions: { path: string; content: string }[] }, path: string) {
  return plan.additions.find((addition) => addition.path === path)?.content;
}

describe("applyOps", () => {
  test("moving a page repairs what pointed at it", () => {
    const applied = applyOps(corpus(), [
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/architecture/patterns/bff.mdx" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/architecture/index.mdx")).toContain("./patterns/bff.mdx");
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("../architecture/patterns/bff.mdx");
    expect(applied.plan.deletions).toEqual(["docs/architecture/bff.mdx"]);
  });

  test("a moved page's own links follow it down a level", () => {
    const applied = applyOps(corpus(), [
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/architecture/patterns/bff.mdx" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/architecture/patterns/bff.mdx")).toContain("../../index.mdx");
  });

  test("a site-absolute link is repaired by its URL", () => {
    const docs = corpus();
    docs.set("docs/tooling/index.mdx", page("Tooling", "See [BFF](/architecture/bff).\n"));

    const applied = applyOps(docs, [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("(/tooling/bff)");
  });

  test("an anchor survives the rewrite", () => {
    const docs = corpus();
    docs.set("docs/tooling/index.mdx", page("Tooling", "See [BFF](../architecture/bff.mdx#why).\n"));

    const applied = applyOps(docs, [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("./bff.mdx#why");
  });

  test("renaming writes one frontmatter field and moves nothing", () => {
    const applied = applyOps(corpus(), [
      { kind: "rename", path: "docs/architecture/bff.mdx", title: "Backend for frontend" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.plan.moves).toEqual([]);
    expect(applied.plan.additions.map(({ path }) => path)).toEqual(["docs/architecture/bff.mdx"]);
    expect(written(applied.plan, "docs/architecture/bff.mdx")).toContain("title: Backend for frontend");
  });

  test("a new address keeps the title it already had", () => {
    const applied = applyOps(corpus(), [
      {
        kind: "move",
        from: "docs/architecture/bff.mdx",
        to: "docs/architecture/backend-for-frontend.mdx",
      },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(written(applied.plan, "docs/architecture/backend-for-frontend.mdx")).toContain("title: BFF");
  });

  test("a page moved twice is rewritten once, for where it ended up", () => {
    const applied = applyOps(corpus(), [
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/bff.mdx" },
      { kind: "move", from: "docs/bff.mdx", to: "docs/tooling/bff.mdx" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.plan.moves).toEqual([{ from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }]);
    expect(written(applied.plan, "docs/architecture/index.mdx")).toContain("../tooling/bff.mdx");
  });

  test("a page created and then moved lands only at its final path", () => {
    const applied = applyOps(corpus(), [
      { kind: "create", path: "docs/draft.mdx", title: "Draft", description: null },
      { kind: "move", from: "docs/draft.mdx", to: "docs/tooling/bun.mdx" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.plan.deletions).toEqual([]);
    expect(applied.plan.additions.map(({ path }) => path)).toEqual(["docs/tooling/bun.mdx"]);
  });

  test("a page given pages of its own keeps its address, its place and its links", () => {
    const applied = applyOps(corpus(), [
      { kind: "nest", path: "docs/architecture/bff.mdx" },
      { kind: "create", path: "docs/architecture/bff/caching.mdx", title: "Caching", description: null },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.plan.deletions).toEqual(["docs/architecture/bff.mdx"]);
    expect(written(applied.plan, "docs/architecture/bff/index.mdx")).toContain("Back to [home](../../index.mdx)");
    expect(written(applied.plan, "docs/architecture/index.mdx")).toContain("./bff/index.mdx");
    expect(written(applied.plan, "docs/architecture/meta.json")).toBeUndefined();
    expect(written(applied.plan, "docs/architecture/bff/meta.json")).toBeUndefined();
    expect(docUrl("docs/architecture/bff/index.mdx")).toBe(docUrl("docs/architecture/bff.mdx"));
  });

  test("a markdown page keeps being markdown once it holds pages", () => {
    const docs = corpus();
    docs.set("docs/tooling/bun.md", page("Bun"));

    const applied = applyOps(docs, [
      { kind: "nest", path: "docs/tooling/bun.md" },
      { kind: "renameSection", path: "docs/tooling/bun", label: "Bun runtime" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/tooling/bun/index.md")).toContain("title: Bun runtime");
  });

  test("refuses to delete a section that still has pages in it", () => {
    const applied = applyOps(corpus(), [{ kind: "delete", path: "docs/architecture/index.mdx" }]);

    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.refusals[0]!.reason).toContain("still has a page inside it");
  });

  test("deleting an empty section takes its meta file too", () => {
    const applied = applyOps(corpus(), [{ kind: "delete", path: "docs/tooling/index.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.plan.deletions.sort()).toEqual(["docs/tooling/index.mdx", "docs/tooling/meta.json"]);
    expect(pagesIn(applied.plan, "docs")).toEqual(["index", "architecture", "..."]);
  });

  test("deleting a page unwrites the links that pointed at it", () => {
    const applied = applyOps(corpus(), [{ kind: "delete", path: "docs/architecture/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/architecture/index.mdx")).toContain("Read the BFF page.\n");
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("The BFF page covers it.\n");
    expect(applied.plan.deletions).toEqual(["docs/architecture/bff.mdx"]);
  });

  test("unwriting a link leaves every other link alone", () => {
    const applied = applyOps(corpus(), [{ kind: "delete", path: "docs/architecture/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(written(applied.plan, "docs/index.mdx")).toBeUndefined();
  });

  test("a site-absolute link to a deleted page is unwritten too", () => {
    const docs = corpus();
    docs.set("docs/tooling/index.mdx", page("Tooling", "The [BFF page](/architecture/bff) covers it.\n"));

    const applied = applyOps(docs, [{ kind: "delete", path: "docs/architecture/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("The BFF page covers it.\n");
  });

  test("deletes a page nothing links to", () => {
    const docs = corpus();
    docs.set("docs/architecture/index.mdx", page("Architecture", "Nothing here.\n"));
    docs.set("docs/tooling/index.mdx", page("Tooling", "Nothing here either.\n"));

    const applied = applyOps(docs, [{ kind: "delete", path: "docs/architecture/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.plan.deletions).toEqual(["docs/architecture/bff.mdx"]);
  });

  test("refuses a move onto a page that is already there", () => {
    const applied = applyOps(corpus(), [
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/index.mdx" },
    ]);

    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.refusals).toEqual([{ op: 0, reason: "docs/tooling/index.mdx already exists." }]);
  });

  test("leaves an untouched corpus untouched", () => {
    const applied = applyOps(corpus(), [
      { kind: "create", path: "docs/tooling/bun.md", title: "Bun", description: null },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.plan.additions.map(({ path }) => path)).toEqual(["docs/tooling/bun.md"]);
    expect(applied.plan.deletions).toEqual([]);
  });

  test("never rewrites an external link or an upload", () => {
    const docs = corpus();
    docs.set(
      "docs/tooling/index.mdx",
      page("Tooling", "![shot](/img/docs/abc.png) and [gh](https://github.com/x) and [bff](../architecture/bff.mdx)"),
    );

    const applied = applyOps(docs, [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const text = written(applied.plan, "docs/tooling/index.mdx") ?? "";
    expect(text).toContain("/img/docs/abc.png");
    expect(text).toContain("https://github.com/x");
    expect(text).toContain("../bff.mdx");
  });

  test("a new page joins the end of the order its folder already keeps", () => {
    const applied = applyOps(corpus(), [
      { kind: "create", path: "docs/architecture/boundaries.md", title: "Boundaries", description: null },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs/architecture")).toEqual(["bff", "boundaries", "..."]);
  });

  test("a new page in a folder that keeps no order writes no order", () => {
    const applied = applyOps(corpus(), [
      { kind: "create", path: "docs/tooling/bun.md", title: "Bun", description: null },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs/tooling")).toBe(null);
  });

  test("a moved page leaves one folder's order and joins another's", () => {
    const docs = corpus();
    docs.set("docs/tooling/meta.json", '{ "title": "Tooling", "pages": ["..."] }\n');

    const applied = applyOps(docs, [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(pagesIn(applied.plan, "docs/architecture")).toEqual(["..."]);
    expect(pagesIn(applied.plan, "docs/tooling")).toEqual(["bff", "..."]);
  });

  test("a moved section leaves its old parent's order and its own file travels with it", () => {
    const applied = applyOps(corpus(), [
      { kind: "moveSection", from: "docs/architecture", to: "docs/tooling/architecture" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(pagesIn(applied.plan, "docs")).toEqual(["index", "tooling", "..."]);
    expect(pagesIn(applied.plan, "docs/tooling/architecture")).toEqual(["bff", "..."]);
    expect(applied.plan.deletions).toContain("docs/architecture/meta.json");
  });

  test("a deleted page comes out of its folder's order", () => {
    const docs = corpus();
    docs.set("docs/architecture/boundaries.md", page("Boundaries"));
    docs.set("docs/architecture/meta.json", '{ "title": "Architecture", "pages": ["bff", "boundaries", "..."] }\n');

    const applied = applyOps(docs, [{ kind: "delete", path: "docs/architecture/boundaries.md" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs/architecture")).toEqual(["bff", "..."]);
  });

  test("a reorder rewrites one folder and leaves the rest alone", () => {
    const docs = corpus();
    docs.set("docs/architecture/boundaries.md", page("Boundaries"));

    const applied = applyOps(docs, [{ kind: "reorder", folder: "docs/architecture", names: ["boundaries", "bff"] }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(pagesIn(applied.plan, "docs/architecture")).toEqual(["boundaries", "bff", "..."]);
    expect(applied.plan.additions.map(({ path }) => path)).toEqual(["docs/architecture/meta.json"]);
  });

  test("a reorder of the root keeps every other key in the root's meta file", () => {
    const applied = applyOps(corpus(), [
      { kind: "reorder", folder: "docs", names: ["architecture", "index", "tooling"] },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/meta.json")).toBe(
      '{\n  "title": "Handbook",\n  "pages": ["architecture", "index", "tooling", "..."]\n}\n',
    );
    expect(applied.plan.additions.map(({ path }) => path)).toEqual(["docs/meta.json"]);
    expect(applied.plan.deletions).toEqual([]);
  });

  test("a reorder keeps an extracted folder where it stands", () => {
    const docs = corpus();
    docs.set("docs/meta.json", '{ "title": "Handbook", "pages": ["index", "...architecture", "tooling", "..."] }\n');

    const applied = applyOps(docs, [{ kind: "reorder", folder: "docs", names: ["tooling", "index"] }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs")).toEqual(["tooling", "...architecture", "index", "..."]);
  });

  test("a reorder puts a separator where it names it, icon and all, and drops one it leaves out", () => {
    const docs = corpus();
    docs.set(
      "docs/meta.json",
      '{ "title": "Handbook", "pages": ["index", "---[Compass]Decisions---", "---Tools---", "tooling", "..."] }\n',
    );

    const applied = applyOps(docs, [
      { kind: "reorder", folder: "docs", names: ["---[Compass]Decisions---", "tooling", "index"] },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs")).toEqual(["---[Compass]Decisions---", "tooling", "index", "..."]);
  });

  test("a reorder puts a link where it names it, icon and all", () => {
    const docs = corpus();
    docs.set(
      "docs/meta.json",
      '{ "title": "Handbook", "pages": ["index", "[Rocket][Next.js](https://nextjs.org/docs)", "architecture", "..."] }\n',
    );

    const applied = applyOps(docs, [
      {
        kind: "reorder",
        folder: "docs",
        names: ["architecture", "[Rocket][Next.js](https://nextjs.org/docs)", "index"],
      },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs")).toEqual([
      "architecture",
      "[Rocket][Next.js](https://nextjs.org/docs)",
      "index",
      "...",
    ]);
  });

  test("a reorder that leaves a link out is how the link is deleted", () => {
    const docs = corpus();
    docs.set(
      "docs/meta.json",
      '{ "title": "Handbook", "pages": ["index", "[Next.js](https://nextjs.org/docs)", "architecture", "..."] }\n',
    );

    const applied = applyOps(docs, [{ kind: "reorder", folder: "docs", names: ["index", "architecture"] }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs")).toEqual(["index", "architecture", "..."]);
  });

  test("a page nobody listed survives a reorder of the siblings that are listed", () => {
    const docs = corpus();
    docs.set("docs/architecture/cqrs.md", page("CQRS"));
    docs.set("docs/architecture/boundaries.md", page("Boundaries"));
    docs.set("docs/architecture/meta.json", '{ "pages": ["bff", "cqrs", "..."] }\n');

    const applied = applyOps(docs, [{ kind: "reorder", folder: "docs/architecture", names: ["cqrs", "bff"] }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(pagesIn(applied.plan, "docs/architecture")).toEqual(["cqrs", "bff", "..."]);
  });
});

describe("path arithmetic", () => {
  test.each([
    ["docs/index.mdx", "/"],
    ["docs/architecture/index.mdx", "/architecture"],
    ["docs/tooling/bun.md", "/tooling/bun"],
  ])("docUrl(%p) is %p", (path, url) => {
    expect(docUrl(path)).toBe(url);
  });

  test.each([
    ["docs/a", "./b.md", "docs/a/b.md"],
    ["docs/a", "../b/c.md", "docs/b/c.md"],
    ["docs/a/b", "../../c.md", "docs/c.md"],
  ])("resolve(%p, %p) is %p", (dir, link, expected) => {
    expect(resolve(dir, link)).toBe(expected);
  });

  test.each([
    ["docs/a", "docs/a/b.md", "./b.md"],
    ["docs/a", "docs/b.md", "../b.md"],
    ["docs/a/b", "docs/c/d.md", "../../c/d.md"],
  ])("relativeTo(%p, %p) is %p", (dir, path, expected) => {
    expect(relativeTo(dir, path)).toBe(expected);
  });

  test.each([
    ["CI/CD and delivery", "ci-cd-and-delivery"],
    ["Søren's page", "soren-s-page"],
    ["???", "page"],
  ])("slugify(%p) is %p", (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });

  test.each([
    "[Next.js](https://nextjs.org/docs)",
    "[Rocket][Next.js](https://nextjs.org/docs)",
    "external:[Status](/status)",
  ])("a link survives being read and spelt again: %p", (entry) => {
    const link = linkIn(entry);

    expect(link).not.toBeNull();
    expect(linkOf(link!)).toBe(entry);
  });

  test.each(["index", "...runbooks", "---Runbooks---", "!manual"])("%p is not a link", (entry) => {
    expect(linkIn(entry)).toBeNull();
  });
});

describe("setField", () => {
  test("replaces a field without touching its neighbours", () => {
    const before = "---\ntitle: Old\ndescription: Kept\nsidebar_position: 2\n---\n\nBody\n";
    expect(setField(before, "title", "New")).toBe(
      "---\ntitle: New\ndescription: Kept\nsidebar_position: 2\n---\n\nBody\n",
    );
  });

  test("quotes a title that would otherwise not parse", () => {
    const patched = setField("---\ntitle: Old\n---\n", "title", "Testing: how we do it");
    expect(patched).toContain('title: "Testing: how we do it"');
  });

  test("adds the field when the frontmatter has no such line", () => {
    expect(setField("---\ntitle: A\n---\n\nBody\n", "description", "B")).toContain("description: B");
  });
});

describe("moving a whole section", () => {
  test("takes every page inside it and repairs the links in", () => {
    const applied = applyOps(corpus(), [
      { kind: "moveSection", from: "docs/architecture", to: "docs/tooling/architecture" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/tooling/architecture/bff.mdx")).toBeDefined();
    expect(written(applied.plan, "docs/tooling/architecture/meta.json")).toBeDefined();
    expect(written(applied.plan, "docs/index.mdx")).toContain("./tooling/architecture/index.mdx");
    expect(written(applied.plan, "docs/tooling/index.mdx")).toContain("./architecture/bff.mdx");
  });

  test("renaming a section carries the title into both files that spell it", () => {
    const applied = applyOps(corpus(), [{ kind: "renameSection", path: "docs/architecture", label: "System design" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.plan.moves).toEqual([]);
    expect(written(applied.plan, "docs/architecture/index.mdx")).toContain("title: System design");
    expect(written(applied.plan, "docs/architecture/meta.json")).toBe(
      '{ "title": "System design", "defaultOpen": true, "pages": ["bff", "..."] }\n',
    );
  });

  test("refuses to move a section inside itself", () => {
    const applied = applyOps(corpus(), [
      { kind: "moveSection", from: "docs/architecture", to: "docs/architecture/nested" },
    ]);

    expect(applied.ok).toBe(false);
  });
});

describe("icons", () => {
  test("a page made in the browser is written with the icon it was drawn with", () => {
    const applied = applyOps(corpus(), [
      { kind: "create", path: "docs/guide.md", title: "Guide", description: null, icon: "FileText" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/guide.md")).toContain("\nicon: FileText\n---");
  });

  test("a page keeps its icon in front matter", () => {
    const applied = applyOps(corpus(), [{ kind: "icon", path: "docs/architecture/bff.mdx", icon: "Server" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/architecture/bff.mdx")).toBe(
      "---\ntitle: BFF\ndescription: A page.\nicon: Server\n---\n\nBack to [home](../index.mdx).\n",
    );
  });

  test("taking a page's icon away removes the line and nothing else", () => {
    const docs = corpus();
    docs.set("docs/architecture/bff.mdx", "---\ntitle: BFF\nicon: Server\ndescription: A page.\n---\n\nBody\n");

    const applied = applyOps(docs, [{ kind: "icon", path: "docs/architecture/bff.mdx", icon: null }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/architecture/bff.mdx")).toBe(
      "---\ntitle: BFF\ndescription: A page.\n---\n\nBody\n",
    );
  });

  test("a section keeps its icon in meta.json and leaves an icon-less landing page alone", () => {
    const applied = applyOps(corpus(), [{ kind: "icon", path: "docs/tooling", icon: "Wrench" }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(written(applied.plan, "docs/tooling/meta.json")).toContain('"icon": "Wrench"');
    expect(written(applied.plan, "docs/tooling/index.mdx")).toBeUndefined();
  });
});

describe("opening by default", () => {
  test("opening a section writes the flag into its meta.json and keeps the rest as written", () => {
    const applied = applyOps(corpus(), [{ kind: "defaultOpen", path: "docs/tooling", open: true }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(JSON.parse(written(applied.plan, "docs/tooling/meta.json") ?? "")).toEqual({
      title: "Tooling",
      defaultOpen: true,
    });
  });

  test("folding a section takes the flag away rather than writing false", () => {
    const applied = applyOps(corpus(), [{ kind: "defaultOpen", path: "docs/architecture", open: false }]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(JSON.parse(written(applied.plan, "docs/architecture/meta.json") ?? "")).toEqual({
      title: "Architecture",
      pages: ["bff", "..."],
    });
  });
});

describe("generated pages", () => {
  const generated = "---\ntitle: API\ngenerated: true\n---\n\nSee [handwritten](../manual.mdx).\n";
  const documents = new Map([
    ["docs/reference/api.mdx", generated],
    ["docs/manual.mdx", page("Manual")],
  ]);

  test("refuses renames, deletes and moves through a containing section", () => {
    const operations = [
      { kind: "rename", path: "docs/reference/api.mdx", title: "Renamed" },
      { kind: "delete", path: "docs/reference/api.mdx" },
      { kind: "move", from: "docs/reference/api.mdx", to: "docs/api.mdx" },
      { kind: "moveSection", from: "docs/reference", to: "docs/elsewhere" },
    ] as const;
    for (const op of operations) {
      expect(applyOps(documents, [op])).toMatchObject({
        ok: false,
        refusals: [{ reason: expect.stringContaining("read-only") }],
      });
    }
    expect(documents.get("docs/reference/api.mdx")).toBe(generated);
  });

  test("refuses indirect link repairs that would rewrite generated content", () => {
    expect(applyOps(documents, [{ kind: "delete", path: "docs/manual.mdx" }])).toMatchObject({
      ok: false,
      refusals: [{ reason: expect.stringContaining("docs/reference/api.mdx") }],
    });
  });

  test("still permits changing an unrelated handwritten page", () => {
    expect(applyOps(documents, [{ kind: "rename", path: "docs/manual.mdx", title: "Guide" }]).ok).toBe(true);
  });
});
