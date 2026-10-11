import { describe, expect, test } from "vitest";
import type * as PageTree from "fumadocs-core/page-tree";
import { orderSections, sectionAccent, sectionTabs } from "./sections";

const page = (url: string, name = url): PageTree.Item => ({ type: "page", name, url });

const tree = (): PageTree.Root => ({
  name: "Documentation",
  description: "Everything this site documents",
  children: [
    page("/", "Home"),
    {
      type: "folder",
      name: "Decision records",
      index: page("/decision-records"),
      children: [page("/decision-records/0005")],
    },
  ],
  fallback: {
    name: "Docs",
    children: [
      {
        type: "folder",
        name: "Docs manual",
        description: "How to's for this site",
        root: true,
        children: [page("/manual", "Overview"), page("/manual/edit-locks")],
      },
      {
        type: "folder",
        name: "Core API",
        description: "Every exported function",
        root: true,
        children: [page("/core-api", "Overview")],
      },
    ],
  },
});

describe("sectionTabs", () => {
  test("offers the main tree and every root folder, wherever it sits", () => {
    expect(sectionTabs(tree()).map((tab) => [tab.title, tab.url])).toEqual([
      ["Documentation", "/"],
      ["Docs manual", "/manual"],
      ["Core API", "/core-api"],
    ]);
  });

  test("claims a section's own pages, and none of a held-out one's", () => {
    const [main, manual] = sectionTabs(tree());

    expect([...(main!.urls ?? [])]).toEqual(["/", "/decision-records", "/decision-records/0005"]);
    expect([...(manual!.urls ?? [])]).toEqual(["/manual", "/manual/edit-locks"]);
  });
});

describe("orderSections", () => {
  test("lists held-out sections in the order the main meta.json names them", () => {
    const sorted = tree();
    orderSections(sorted, ["index", "!core-api", "!manual"]);

    expect(sectionTabs(sorted).map((tab) => tab.title)).toEqual(["Documentation", "Core API", "Docs manual"]);
  });
});

describe("sectionAccent", () => {
  test.each([
    ["/", "var(--jd-section-home, var(--primary))"],
    ["/manual", "var(--jd-section-manual, var(--jd-section-home, var(--primary)))"],
    ["/manual/edit-locks", "var(--jd-section-manual, var(--jd-section-home, var(--primary)))"],
  ])("paints %s from %s", (pathname, accent) => {
    expect(sectionAccent(pathname)).toBe(accent);
  });

  /** A segment is a token name, so anything that cannot be one is dropped. */
  test("keeps a stray path segment out of the token name", () => {
    expect(sectionAccent("/foo);color:red")).toBe(
      "var(--jd-section-foocolorred, var(--jd-section-home, var(--primary)))",
    );
  });
});
