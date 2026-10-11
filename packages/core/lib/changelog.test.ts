import { describe, expect, test } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import { releaseId, remarkChangelog, written } from "./changelog";

type Node = {
  type: string;
  name?: string;
  attributes?: { type: "mdxJsxAttribute"; name: string; value: string }[];
  children?: Node[];
};

const page = `# Changelog

All notable changes will be documented in this file.

## [2.15.6](https://github.com/o/r/compare/v2.15.5...v2.15.6) (2026-09-04)

This release moves the calculator off the old rates table.

### Bug Fixes

* **infra:** stop null query killing redirects ([ae6ab07](https://github.com/o/r/commit/ae6ab07))

### [2.15.5](https://github.com/o/r/compare/v2.15.4...v2.15.5) (2026-08-26)

### Bug Fixes

* fixed event visibility ([b9e85aa](https://github.com/o/r/commit/b9e85aa))

## [2.15.4](https://github.com/o/r/compare/v2.15.3...v2.15.4) (2026-08-06)

## 2.15.3 (2026-08-05)

Released with no sections.
`;

/** The page, compiled as far as the plugin, with the timeline's children handed back. */
function releasesIn(markdown: string, frontmatter: unknown = { changelog: true }): Node[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMdx).parse(markdown) as Node;
  remarkChangelog()(tree, { data: { frontmatter } });

  const timeline = tree.children?.find((node) => node.name === "ChangelogTimeline");
  return timeline?.children ?? [];
}

const propsOf = (node: Node) =>
  Object.fromEntries((node.attributes ?? []).map((attribute) => [attribute.name, attribute.value]));

describe("remarkChangelog", () => {
  test("wraps every dated version heading in one release element", () => {
    expect(releasesIn(page).map((node) => [node.name, propsOf(node).version])).toEqual([
      ["ChangelogRelease", "2.15.6"],
      ["ChangelogRelease", "2.15.5"],
      ["ChangelogRelease", "2.15.4"],
      ["ChangelogRelease", "2.15.3"],
    ]);
  });

  test("leaves the preamble above the first release where the file put it", () => {
    const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMdx).parse(page) as Node;
    remarkChangelog()(tree, { data: { frontmatter: { changelog: true } } });

    expect(tree.children?.map((node) => node.type)).toEqual(["heading", "paragraph", "mdxJsxFlowElement"]);
  });

  test("passes a release's own prose through beside its sections", () => {
    expect(releasesIn(page)[0]!.children?.map((child) => [child.type, child.name])).toEqual([
      ["paragraph", undefined],
      ["mdxJsxFlowElement", "ChangelogSection"],
      ["list", undefined],
    ]);
  });

  test("takes the date and the compare link off the heading it consumed", () => {
    expect(propsOf(releasesIn(page)[0]!)).toMatchObject({
      date: "2026-09-04",
      compare: "https://github.com/o/r/compare/v2.15.5...v2.15.6",
    });
  });

  test("leaves a release with no compare link without the attribute", () => {
    expect(propsOf(releasesIn(page).at(-1)!)).not.toHaveProperty("compare");
  });

  test("reads a version of one, two or three numbers, tagged or not", () => {
    const tags = `## v1 (2026-09-10)

## 1.3 (2026-09-08)

## [v1.2.11](https://github.com/o/r/compare/v1.2.10...v1.2.11) (2026-09-01)

## 1.2.0-rc.1 (2026-08-28)
`;

    expect(releasesIn(tags).map((node) => propsOf(node).version)).toEqual(["1", "1.3", "1.2.11", "1.2.0-rc.1"]);
  });

  test("leaves a page without the front matter flag alone", () => {
    expect(releasesIn(page, { changelog: "yes" })).toEqual([]);
  });
});

describe("releaseId", () => {
  test("names the anchor a version is linkable at", () => {
    expect(releaseId("2.15.6")).toBe("release-2.15.6");
  });
});

describe("written", () => {
  test("spells a release date the way a person reads it", () => {
    expect(written("2026-09-04")).toBe("4 September 2026");
  });
});
