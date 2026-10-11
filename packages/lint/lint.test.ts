import { expect, test } from "vitest";
import { lintFile } from "./lint";

/** A page with valid front matter above `body`. */
const page = (body: string, front = "title: Page\ndescription: About it") => `---\n${front}\n---\n\n${body}\n`;

/** Each problem as `line rule`, which is what an author jumps to. */
const found = (path: string, text: string) => lintFile(path, text).map(({ line, rule }) => `${line} ${rule}`);

test("passes a page that parses and runs nothing", () => {
  expect(found("docs/a.mdx", page('<Tabs items={["One", "Two"]} />'))).toEqual([]);
});

test("reports what breaks a page on the line it was written", () => {
  expect(found("docs/a.mdx", page("{process.exit()}"))).toEqual(["6 content-only"]);
  expect(found("docs/a.mdx", page("Hello <Card title="))).toEqual(["6 mdx"]);
  expect(found("docs/a.mdx", page("Body", "title: Icon\ndescription: An icon\nicon: 3"))).toEqual(["4 front-matter"]);
  expect(found("docs/meta.json", '{ "pages": 3 }')).toEqual(["1 meta"]);
});

test("checks a page for code whatever its front matter says", () => {
  expect(found("docs/a.mdx", page("{process.exit()}", "title: Flagged\ngenerated: true"))).toEqual(["6 content-only"]);
});

test("warns about the house style", () => {
  expect(
    found("docs/a.mdx", page("# Title again\n\nUse `[setup](./b.mdx)`.", "title: Home\nsidebar_position: 2")),
  ).toEqual(["1 description", "3 unknown-field", "6 page-heading", "8 code-link"]);
  expect(found("docs/a.md", page("<Tabs items={[]} />"))).toEqual(["6 md-component"]);
});

test("warns when an ordinary folder lists its own index page", () => {
  expect(found("docs/guides/meta.json", '{\n  "pages": ["index", "..."]\n}')).toEqual(["2 listed-index"]);
  expect(found("docs/guides/meta.json", '{ "root": true, "pages": ["index", "..."] }')).toEqual([]);
  expect(found("docs/meta.json", '{ "pages": ["index", "..."] }')).toEqual([]);
  expect(found("apps/docs/docs/meta.json", '{ "pages": ["index", "..."] }')).toEqual([]);
});

test("leaves generated pages and changelogs out of the house style", () => {
  expect(found("docs/api.md", page("# Generated", "title: API\ngenerated: true"))).toEqual([]);
  expect(found("docs/changes.md", page("# 1.0.0", "title: Changes\nchangelog: true\nversion: 1"))).toEqual([]);
});
