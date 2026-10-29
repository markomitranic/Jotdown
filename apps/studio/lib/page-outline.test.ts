import { describe, expect, it } from "vitest";
import type * as PageTree from "fumadocs-core/page-tree";
import { pageOutline } from "./page-outline";

const page = (name: string, url: string): PageTree.Item => ({ type: "page", name, url });

describe("pageOutline", () => {
  it("gathers the pages after each separator into a group, and follows them with the held-out sections", () => {
    const tree: PageTree.Root = {
      name: "Guide",
      children: [
        page("Welcome", "/"),
        { type: "separator", name: "Studio" },
        page("Branding", "/studio/branding"),
        { type: "separator", name: "Empty" },
      ],
      fallback: {
        name: "Sections",
        children: [
          {
            type: "folder",
            name: "Examples",
            root: true,
            index: page("Examples", "/examples"),
            children: [page("Every block", "/examples/every-block")],
          },
        ],
      },
    };

    expect(pageOutline(tree, { "/examples": "docs/examples/index.mdx" })).toEqual([
      { title: "Welcome", url: "/", path: null, children: [] },
      {
        title: "Studio",
        url: null,
        path: null,
        children: [{ title: "Branding", url: "/studio/branding", path: null, children: [] }],
      },
      {
        title: "Examples",
        url: "/examples",
        path: "docs/examples/index.mdx",
        children: [{ title: "Every block", url: "/examples/every-block", path: null, children: [] }],
      },
    ]);
  });

  it("leaves out links to other sites", () => {
    const tree: PageTree.Root = {
      name: "Guide",
      children: [{ ...page("GitHub", "https://github.com"), external: true }],
    };
    expect(pageOutline(tree)).toEqual([]);
  });
});
