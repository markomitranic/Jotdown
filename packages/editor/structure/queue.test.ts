/**
 * What the reader sees while a queue is staged but not yet saved.
 *
 * The point of staging is that somebody rearranging three pages can see the
 * shape they are making before they commit to it, so the sidebar has to show
 * the result rather than a list of intentions. These cases are that promise.
 */

import { describe, expect, test } from "vitest";
import { linkOf } from "@jotdown/core/lib/paths";
import {
  addEntryOp,
  destinations,
  dropOps,
  flatten,
  iconOp,
  kindOf,
  moveOp,
  pendingFor,
  projectDrop,
  refold,
  removeEntryOp,
  renameOp,
  respellOp,
  stage,
  stagedPath,
  type TreeNode,
} from "./queue";
import type { DocEntry, StructureOp } from "../types";

const docs: Record<string, DocEntry> = {
  "/architecture": { source: "docs/architecture/index.mdx", title: "Architecture" },
  "/architecture/bff": { source: "docs/architecture/bff.mdx", title: "BFF" },
  "/tooling": { source: "docs/tooling/index.mdx", title: "Tooling" },
};

const page = (name: string, url: string): TreeNode => ({ type: "page", name, url });

const section = (name: string, url: string, children: TreeNode[]): TreeNode => ({
  type: "folder",
  name,
  index: { type: "page", name, url },
  children,
});

const sidebar = (): TreeNode[] => [
  section("Architecture", "/architecture", [page("BFF", "/architecture/bff")]),
  section("Tooling", "/tooling", []),
];

/** The names at one level, so a test can assert shape without matching objects. */
function labels(nodes: TreeNode[]): string[] {
  return nodes.map((node) => (typeof node.name === "string" ? node.name : "?"));
}

function childrenOf(nodes: TreeNode[], name: string): TreeNode[] {
  const found = nodes.find((node) => node.name === name);
  return found && found.type === "folder" ? found.children : [];
}

describe("stage", () => {
  test("hands back the same tree when nothing is queued", () => {
    const items = sidebar();
    expect(stage(items, [], docs)).toEqual(items);
  });

  test("shows a moved page under the section it is headed for", () => {
    const ops: StructureOp[] = [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }];
    const staged = stage(sidebar(), ops, docs);

    expect(childrenOf(staged, "Architecture")).toEqual([]);
    expect(labels(childrenOf(staged, "Tooling"))).toEqual(["BFF"]);
  });

  test("shows a created page inside the section it was created in", () => {
    const ops: StructureOp[] = [{ kind: "create", path: "docs/tooling/bun.md", title: "Bun", description: null }];

    expect(labels(childrenOf(stage(sidebar(), ops, docs), "Tooling"))).toEqual(["Bun"]);
  });

  test("a page given a page of its own stays where it was and holds it", () => {
    const ops: StructureOp[] = [
      { kind: "nest", path: "docs/architecture/bff.mdx" },
      { kind: "create", path: "docs/architecture/bff/caching.mdx", title: "Caching", description: null },
    ];
    const staged = stage(sidebar(), ops, docs);

    expect(labels(childrenOf(staged, "Architecture"))).toEqual(["BFF"]);
    expect(labels(childrenOf(childrenOf(staged, "Architecture"), "BFF"))).toEqual(["Caching"]);
    expect(pendingFor(ops, "docs/architecture/bff.mdx")).toBe(null);
  });

  test("carries a renamed page's new label", () => {
    const ops: StructureOp[] = [{ kind: "rename", path: "docs/architecture/bff.mdx", title: "Backend for frontend" }];

    expect(labels(childrenOf(stage(sidebar(), ops, docs), "Architecture"))).toEqual(["Backend for frontend"]);
  });

  test("a new address leaves the label where it was", () => {
    const ops: StructureOp[] = [
      {
        kind: "move",
        from: "docs/architecture/bff.mdx",
        to: "docs/architecture/backend-for-frontend.mdx",
      },
    ];

    expect(labels(childrenOf(stage(sidebar(), ops, docs), "Architecture"))).toEqual(["BFF"]);
  });

  test("takes a moved section's pages along with it", () => {
    const ops: StructureOp[] = [{ kind: "moveSection", from: "docs/architecture", to: "docs/tooling/architecture" }];
    const staged = stage(sidebar(), ops, docs);

    expect(labels(staged)).toEqual(["Tooling"]);
    expect(labels(childrenOf(staged, "Tooling"))).toEqual(["Architecture"]);
  });

  test("drops a deleted page", () => {
    const ops: StructureOp[] = [{ kind: "delete", path: "docs/architecture/bff.mdx" }];

    expect(childrenOf(stage(sidebar(), ops, docs), "Architecture")).toEqual([]);
  });

  test("a page created then moved appears only where it ended up", () => {
    const ops: StructureOp[] = [
      { kind: "create", path: "docs/architecture/bun.md", title: "Bun", description: null },
      { kind: "move", from: "docs/architecture/bun.md", to: "docs/tooling/bun.md" },
    ];
    const staged = stage(sidebar(), ops, docs);

    expect(labels(childrenOf(staged, "Architecture"))).toEqual(["BFF"]);
    expect(labels(childrenOf(staged, "Tooling"))).toEqual(["Bun"]);
  });
});

describe("pendingFor", () => {
  const moved: StructureOp[] = [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" }];
  const reslugged: StructureOp[] = [{ kind: "move", from: "docs/architecture/bff.mdx", to: "docs/architecture/b.mdx" }];
  const renamed: StructureOp[] = [{ kind: "rename", path: "docs/architecture/bff.mdx", title: "Backend for frontend" }];

  test("tells the three apart: a new folder, a new address, a new title", () => {
    expect(pendingFor(moved, "docs/architecture/bff.mdx")).toBe("moved");
    expect(pendingFor(reslugged, "docs/architecture/bff.mdx")).toBe("url");
    expect(pendingFor(renamed, "docs/architecture/bff.mdx")).toBe("renamed");
  });

  test("says nothing about a page the queue never touched", () => {
    expect(pendingFor(moved, "docs/tooling/index.mdx")).toBe(null);
  });
});

describe("stagedPath", () => {
  test("follows a page through two moves in the same queue", () => {
    const ops: StructureOp[] = [
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/bff.mdx" },
      { kind: "move", from: "docs/bff.mdx", to: "docs/tooling/bff.mdx" },
    ];

    expect(stagedPath(ops, "docs/architecture/bff.mdx")).toBe("docs/tooling/bff.mdx");
  });

  test("carries a page along when the section around it moves", () => {
    const ops: StructureOp[] = [{ kind: "moveSection", from: "docs/architecture", to: "docs/tooling/architecture" }];

    expect(stagedPath(ops, "docs/architecture/bff.mdx")).toBe("docs/tooling/architecture/bff.mdx");
  });

  test("is null once the page has been deleted", () => {
    expect(stagedPath([{ kind: "delete", path: "docs/architecture/bff.mdx" }], "docs/architecture/bff.mdx")).toBe(null);
  });

  test("leaves a page the queue never touched where it was", () => {
    expect(stagedPath([], "docs/architecture/bff.mdx")).toBe("docs/architecture/bff.mdx");
  });
});

describe("moveOp", () => {
  test("is nothing at all when neither the folder nor the name changed", () => {
    expect(moveOp("docs/architecture/bff.mdx", "docs/architecture")).toBe(null);
  });

  test("slugifies a new address and leaves the title alone", () => {
    expect(moveOp("docs/architecture/bff.mdx", "docs/architecture", "Backend for frontend")).toEqual({
      kind: "move",
      from: "docs/architecture/bff.mdx",
      to: "docs/architecture/backend-for-frontend.mdx",
    });
  });

  test("keeps the filename when only the folder changed", () => {
    expect(moveOp("docs/architecture/bff.mdx", "docs/tooling")).toEqual({
      kind: "move",
      from: "docs/architecture/bff.mdx",
      to: "docs/tooling/bff.mdx",
    });
  });
});

describe("flatten and dropOps", () => {
  const rows = (closed: string[] = []) => flatten(sidebar(), docs, {}, [], new Set(closed));

  /** Which rows are in the list, as `depth:path`, so shape and order both show. */
  const shape = (list: ReturnType<typeof rows>) => list.map((row) => `${row.depth}:${row.path ?? "?"}`);

  test("walks the tree into one list, deepest last", () => {
    expect(shape(rows())).toEqual(["0:docs/architecture", "1:docs/architecture/bff.mdx", "0:docs/tooling"]);
  });

  test("leaves a shut section's pages out of the list", () => {
    expect(shape(rows(["docs/architecture"]))).toEqual(["0:docs/architecture", "0:docs/tooling"]);
  });

  test("dropping a page below another section moves it and orders that section", () => {
    const list = rows();

    expect(dropOps(list, 1, 2, "docs/tooling")).toEqual([
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/tooling/bff.mdx" },
      { kind: "reorder", folder: "docs/tooling", names: ["bff"] },
    ]);
  });

  test("dragging left out of a section lands it at the level above", () => {
    const list = rows();

    expect(dropOps(list, 1, 2, "docs")).toEqual([
      { kind: "move", from: "docs/architecture/bff.mdx", to: "docs/bff.mdx" },
      { kind: "reorder", folder: "docs", names: ["architecture", "tooling", "bff"] },
    ]);
  });

  test("a drop that changes nothing stages nothing", () => {
    const list = rows();
    expect(dropOps(list, 1, 1, "docs/architecture")).toEqual([]);
  });

  test("reordering two sections is one op and no move", () => {
    const list = rows(["docs/architecture"]);

    expect(dropOps(list, 1, 0, "docs")).toEqual([
      { kind: "reorder", folder: "docs", names: ["tooling", "architecture"] },
    ]);
  });

  test("dropping into a shut section only moves, since its order is out of sight", () => {
    const list = rows(["docs/architecture"]);

    expect(dropOps(list, 1, 1, "docs/architecture")).toEqual([
      { kind: "moveSection", from: "docs/tooling", to: "docs/architecture/tooling" },
    ]);
  });
});

describe("projectDrop", () => {
  const rows = (closed: string[] = []) => flatten(sidebar(), docs, {}, [], new Set(closed));

  /**
   * A click on a row is a drag of no distance, and the row above a top-level
   * section is usually a page inside the section before it. Reading the folder
   * off that row would nest one section inside another for a click.
   */
  test("a row that never moved lands where it was", () => {
    expect(projectDrop(rows(), 2, 2, 0, 12)).toEqual({ depth: 0, folder: "docs" });
  });

  test("dragging right steps a row into the section above", () => {
    expect(projectDrop(rows(), 2, 2, 12, 12)).toEqual({ depth: 1, folder: "docs/architecture" });
  });

  test("dragging left steps a page out of its section", () => {
    expect(projectDrop(rows(), 1, 2, -12, 12)).toEqual({ depth: 0, folder: "docs" });
  });

  test("dragging right of a page puts the row inside it, as the folder it will become", () => {
    expect(projectDrop(rows(), 2, 2, 48, 12)).toEqual({
      depth: 2,
      folder: "docs/architecture/bff",
      nest: "docs/architecture/bff.mdx",
    });
  });

  test("a drop inside a page makes that page a folder first", () => {
    expect(dropOps(rows(), 2, 2, "docs/architecture/bff", "docs/architecture/bff.mdx")).toEqual([
      { kind: "nest", path: "docs/architecture/bff.mdx" },
      { kind: "moveSection", from: "docs/tooling", to: "docs/architecture/bff/tooling" },
      { kind: "reorder", folder: "docs/architecture/bff", names: ["tooling"] },
    ]);
  });

  test("the gap between a section and its first page is inside the section", () => {
    const list = rows();
    expect(projectDrop(list, 2, 1, -48, 12)).toEqual({ depth: 1, folder: "docs/architecture" });
  });

  test("a shut section above can be dropped into", () => {
    expect(projectDrop(rows(["docs/architecture"]), 1, 1, 12, 12)).toEqual({
      depth: 1,
      folder: "docs/architecture",
    });
  });
});

/**
 * A `"root": true` section is a sidebar of its own, so the tree the arranger is
 * handed starts at that section's folder and not at `docs`. Reading the top
 * level as the docs root aimed every drag at `docs/meta.json` and wrote the
 * section's page names into it, which orders nothing and unlists whatever the
 * root had placed by hand.
 */
describe("inside a section's own sidebar", () => {
  const inside: Record<string, DocEntry> = {
    "/site-internals": { source: "docs/site-internals/index.mdx", title: "Overview" },
    "/site-internals/edit-locks": { source: "docs/site-internals/edit-locks.mdx", title: "Edit locks" },
    "/site-internals/changelog": { source: "docs/site-internals/changelog.md", title: "Changelog" },
  };

  const tree = (): TreeNode[] => [
    page("Overview", "/site-internals"),
    page("Edit locks", "/site-internals/edit-locks"),
    page("Changelog", "/site-internals/changelog"),
  ];

  const rows = () => flatten(tree(), inside, {}, [], new Set(), "docs/site-internals");

  test("every top-level row sits in the section rather than the docs root", () => {
    expect(rows().map((row) => row.folder)).toEqual([
      "docs/site-internals",
      "docs/site-internals",
      "docs/site-internals",
    ]);
  });

  test("a page dragged to the top reorders the section's own meta.json", () => {
    expect(dropOps(rows(), 2, 1, "docs/site-internals")).toEqual([
      { kind: "reorder", folder: "docs/site-internals", names: ["index", "changelog", "edit-locks"] },
    ]);
  });

  test("dragging left cannot take a page out of the section it is the sidebar of", () => {
    expect(projectDrop(rows(), 2, 1, -100, 12, "docs/site-internals")).toEqual({
      depth: 0,
      folder: "docs/site-internals",
    });
  });
});

describe("refold", () => {
  const extracted: Record<string, DocEntry> = {
    ...docs,
    "/browser-editor": { source: "docs/site-internals/browser-editor.mdx", title: "Browser editor" },
    "/edit-locks": { source: "docs/site-internals/edit-locks.mdx", title: "Edit locks" },
    "/decision-records": { source: "docs/decision-records/index.mdx", title: "Decision records" },
    "/decision-records/adrs": { source: "docs/decision-records/adrs.mdx", title: "How we write ADRs" },
  };

  /** The root as Fumadocs hands over `...site-internals` and `...decision-records`, each under a separator. */
  const inlined = (): TreeNode[] => [
    { type: "separator", name: "Site internals" },
    page("Browser editor", "/browser-editor"),
    page("Edit locks", "/edit-locks"),
    { type: "separator", name: "Decision records" },
    page("Decision records", "/decision-records"),
    page("How we write ADRs", "/decision-records/adrs"),
  ];

  test("folds a run of inlined pages into their folder and leaves the separator above as a row", () => {
    const tree = refold(inlined(), extracted);

    expect(tree.map(kindOf)).toEqual(["separator", "section", "separator", "section"]);
    expect(labels(tree)).toEqual(["Site internals", "site-internals", "Decision records", "Decision records"]);
  });

  test("a folder that has an index keeps it as its landing page", () => {
    const records = refold(inlined(), extracted)[3]!;

    expect(records.type === "folder" && records.index?.url).toBe("/decision-records");
    expect(labels(records.type === "folder" ? records.children : [])).toEqual(["How we write ADRs"]);
  });

  const rows = () => flatten(refold(inlined(), extracted), extracted, {}, [], new Set());

  /** The studio's sidebar drew a folder row a publication never shows. Both must read the same. */
  test("draws the pages flat, as a publication does, each a row of its own folder", () => {
    expect(rows().map((row) => `${row.depth}:${row.path ?? row.kind}`)).toEqual([
      "0:separator",
      "0:docs/site-internals/browser-editor.mdx",
      "0:docs/site-internals/edit-locks.mdx",
      "0:separator",
      "0:docs/decision-records/index.mdx",
      "0:docs/decision-records/adrs.mdx",
    ]);
    expect(dropOps(rows(), 2, 1, "docs/site-internals")).toEqual([
      { kind: "reorder", folder: "docs/site-internals", names: ["edit-locks", "browser-editor"] },
    ]);
  });

  test("a page dropped after an extracted folder's last page joins that folder", () => {
    expect(projectDrop(rows(), 5, 3, 0, 12)).toEqual({ depth: 0, folder: "docs/site-internals" });
  });

  test("a page dropped just under a separator joins the folder below it", () => {
    expect(projectDrop(rows(), 5, 4, 0, 12)).toEqual({ depth: 0, folder: "docs/decision-records" });
  });

  test("leaves an ordinary tree exactly as it was", () => {
    expect(refold(sidebar(), docs)).toEqual(sidebar());
  });

  /**
   * A `"root": true` section gets a sidebar of its own, so the level is that
   * section's folder rather than the docs root. Judging it as the docs root
   * would fold the whole sidebar into one made-up folder.
   */
  test("a root section's own sidebar is left flat", () => {
    const inside: TreeNode[] = [page("Browser editor", "/browser-editor"), page("Edit locks", "/edit-locks")];

    expect(refold(inside, extracted)).toEqual(inside);
  });
});

describe("icons", () => {
  test("the staged sidebar draws an icon that has only been queued", () => {
    const ops: StructureOp[] = [{ kind: "icon", path: "docs/architecture/bff.mdx", icon: "Server" }];
    const bff = childrenOf(stage(sidebar(), ops, docs), "Architecture")[0]!;

    expect(bff.liveIcon).toBe("Server");
    expect(pendingFor(ops, "docs/architecture/bff.mdx")).toBe("icon");
  });
});

/**
 * A folder with a `meta.json` and no `index.mdx`, a changelog split by major
 * version, is drawn by Fumadocs as an ordinary folder with nothing naming its
 * path. It used to be an inert row that could not be dragged or dropped into.
 */
describe("a folder with no landing page", () => {
  const withChangelog: Record<string, DocEntry> = {
    ...docs,
    "/changelog/v2": { source: "docs/changelog/v2.md", title: "v2" },
  };

  const tree = (): TreeNode[] => [
    ...sidebar(),
    { type: "folder", name: "Changelog", children: [page("v2", "/changelog/v2")] },
  ];

  test("comes back as a section named by the folder its pages share", () => {
    const changelog = refold(tree(), withChangelog)[2]!;

    expect(kindOf(changelog)).toBe("section");
    expect(flatten([changelog], withChangelog, {}, [], new Set()).map((row) => row.path)).toEqual([
      "docs/changelog",
      "docs/changelog/v2.md",
    ]);
  });
});

describe("kindOf", () => {
  test("a separator is a row of its own", () => {
    expect(kindOf({ type: "separator", name: "Reference" })).toBe("separator");
  });

  test("a row pointing off the site is a link rather than a page", () => {
    expect(kindOf({ type: "page", name: "Figma", url: "https://figma.com", external: true })).toBe("link");
  });

  test("a link Fumadocs left no flag on is still read as one", () => {
    expect(kindOf({ type: "page", name: "Next.js", url: "https://nextjs.org/docs" })).toBe("link");
  });

  test("a folder with no landing page of its own is not a section", () => {
    expect(kindOf({ type: "folder", name: "Grouped", children: [] })).toBe("other");
  });
});

describe("sidebar links", () => {
  const written = "[Rocket][Next.js](https://nextjs.org/docs)";
  const links = { docs: [written] };
  const figma = { label: "Figma", url: "https://figma.com", icon: null, external: true };

  const tree = (): TreeNode[] => [page("Next.js", "https://nextjs.org/docs"), ...sidebar()];

  const rows = (ops: StructureOp[] = []) => flatten(stage(tree(), ops, docs), docs, links, ops, new Set());

  test("a link row goes by the entry its meta.json wrote, icon and all", () => {
    expect(rows()[0]!.token).toBe(written);
  });

  test("adding one names every sibling too, so the order drops nothing", () => {
    expect(addEntryOp(rows(), "docs", linkOf(figma))).toEqual({
      kind: "reorder",
      folder: "docs",
      names: [written, "architecture", "tooling", "[Figma](https://figma.com)"],
    });
  });

  test("deleting one is the same order without it", () => {
    expect(removeEntryOp(rows(), rows()[0]!)).toEqual({
      kind: "reorder",
      folder: "docs",
      names: ["architecture", "tooling"],
    });
  });

  test("re-pointing one keeps the place it was in", () => {
    const op = respellOp(rows(), rows()[0]!, linkOf({ ...figma, label: "Next.js", icon: "Rocket" }));

    expect(op).toEqual({
      kind: "reorder",
      folder: "docs",
      names: ["[Rocket][Next.js](https://figma.com)", "architecture", "tooling"],
    });
  });

  test("dragging one into a section takes it out of the folder it left", () => {
    expect(dropOps(rows(), 0, 2, "docs/architecture")).toEqual([
      { kind: "reorder", folder: "docs", names: ["architecture", "tooling"] },
      { kind: "reorder", folder: "docs/architecture", names: ["bff", written] },
    ]);
  });

  test("the staged sidebar draws a link that has only been queued", () => {
    const ops = [addEntryOp(rows(), "docs", linkOf(figma))];

    expect(labels(stage(tree(), ops, docs))).toEqual(["Next.js", "Architecture", "Tooling", "Figma"]);
  });
});

describe("separators", () => {
  const written = "---[Compass]Guides---";
  const entries = { docs: [written] };

  const tree = (): TreeNode[] => [{ type: "separator", name: "Guides" }, ...sidebar()];

  const rows = (ops: StructureOp[] = []) => flatten(stage(tree(), ops, docs), docs, entries, ops, new Set());

  test("a separator row goes by the entry its meta.json wrote, icon and all", () => {
    expect(rows()[0]!.token).toBe(written);
  });

  test("renaming one respells it in place and keeps its icon", () => {
    expect(renameOp(rows(), rows()[0]!, "Handbook")).toEqual({
      kind: "reorder",
      folder: "docs",
      names: ["---[Compass]Handbook---", "architecture", "tooling"],
    });
  });

  test("a new icon respells it and keeps its label", () => {
    expect(iconOp(rows(), rows()[0]!, null)).toEqual({
      kind: "reorder",
      folder: "docs",
      names: ["---Guides---", "architecture", "tooling"],
    });
  });

  test("dragging one to the end moves it there in the order", () => {
    expect(dropOps(rows(), 0, 3, "docs")).toEqual([
      { kind: "reorder", folder: "docs", names: ["architecture", "tooling", written] },
    ]);
  });

  test("the staged sidebar draws a separator that has only been queued", () => {
    const ops = [addEntryOp(rows(), "docs", "---Reference---")];

    expect(labels(stage(tree(), ops, docs))).toEqual(["Guides", "Architecture", "Tooling", "Reference"]);
  });
});

describe("destinations", () => {
  test("offers the top level and every section", () => {
    expect(destinations(sidebar(), docs, null).map(({ path }) => path)).toEqual([
      "docs",
      "docs/architecture",
      "docs/tooling",
    ]);
  });

  test("offers a page just given pages of its own as the folder it now is", () => {
    const ops: StructureOp[] = [{ kind: "nest", path: "docs/architecture/bff.mdx" }];

    expect(destinations(stage(sidebar(), ops, docs), docs, null, ops).map(({ path }) => path)).toContain(
      "docs/architecture/bff",
    );
  });

  test("never offers a section a home inside itself", () => {
    expect(destinations(sidebar(), docs, "docs/architecture").map(({ path }) => path)).toEqual([
      "docs",
      "docs/tooling",
    ]);
  });
});

describe("stage, in both directions", () => {
  /**
   * The case a one-pass detach-and-reattach silently loses: the destination is
   * drawn before the page leaves the section it was in.
   */
  test("shows a page moved into a section that comes earlier in the tree", () => {
    const docs2 = { ...docs, "/tooling/bun": { source: "docs/tooling/bun.md", title: "Bun" } };
    const items: TreeNode[] = [
      section("Architecture", "/architecture", []),
      section("Tooling", "/tooling", [page("Bun", "/tooling/bun")]),
    ];

    const staged = stage(items, [{ kind: "move", from: "docs/tooling/bun.md", to: "docs/architecture/bun.md" }], docs2);

    expect(labels(childrenOf(staged, "Architecture"))).toEqual(["Bun"]);
    expect(childrenOf(staged, "Tooling")).toEqual([]);
  });

  /**
   * The order was staged against the folder's old address, and the endpoint
   * carries that array along when the folder moves. The preview has to as well,
   * or it shows the reorder being undone by the move.
   */
  test("keeps a section's new order after the section itself moves", () => {
    const docs2 = {
      ...docs,
      "/architecture/cqrs": { source: "docs/architecture/cqrs.md", title: "CQRS" },
    };
    const items = sidebar();
    childrenOf(items, "Architecture").push(page("CQRS", "/architecture/cqrs"));

    const staged = stage(
      items,
      [
        { kind: "reorder", folder: "docs/architecture", names: ["cqrs", "bff"] },
        { kind: "moveSection", from: "docs/architecture", to: "docs/tooling/architecture" },
      ],
      docs2,
    );

    expect(labels(childrenOf(childrenOf(staged, "Tooling"), "Architecture"))).toEqual(["CQRS", "BFF"]);
  });

  test("shows a page moved into a page that was given pages in the same queue", () => {
    const docs2 = { ...docs, "/tooling/bun": { source: "docs/tooling/bun.md", title: "Bun" } };
    const items: TreeNode[] = [
      section("Architecture", "/architecture", [page("BFF", "/architecture/bff")]),
      section("Tooling", "/tooling", [page("Bun", "/tooling/bun")]),
    ];

    const staged = stage(
      items,
      [
        { kind: "nest", path: "docs/architecture/bff.mdx" },
        { kind: "move", from: "docs/tooling/bun.md", to: "docs/architecture/bff/bun.md" },
      ],
      docs2,
    );

    expect(labels(childrenOf(childrenOf(staged, "Architecture"), "BFF"))).toEqual(["Bun"]);
    expect(childrenOf(staged, "Tooling")).toEqual([]);
  });
});
