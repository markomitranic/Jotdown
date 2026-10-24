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

    expect(pageOutline(tree)).toEqual([
      { title: "Welcome", url: "/", children: [] },
      { title: "Studio", url: null, children: [{ title: "Branding", url: "/studio/branding", children: [] }] },
      {
        title: "Examples",
        url: "/examples",
        children: [{ title: "Every block", url: "/examples/every-block", children: [] }],
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
