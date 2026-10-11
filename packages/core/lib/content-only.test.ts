import { expect, test } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { executableContent } from "./content-only";

/** What would run in a source parsed as MDX, as the reasons given. */
function check(source: string) {
  return executableContent(unified().use(remarkParse).use(remarkMdx).parse(source)).map(({ reason }) => reason);
}

test("keeps literal component settings, SVG styles and text templates", () => {
  expect(
    check('<Tabs items={["One", "Two"]}><svg style={{ opacity: 0.5 }}><text x={-5}>{`Label`}</text></svg></Tabs>'),
  ).toEqual([]);
});

test.each([
  'import fs from "node:fs"',
  "{process.exit()}",
  "<Card title={globalThis.process.env.HOME} />",
  "<div {...process.env} />",
  "<div onClick={() => alert(1)} />",
  "<script>bad()</script>",
  '<div dangerouslySetInnerHTML={{__html:"bad"}} />',
  "<Card title={{get name() { return process.env; }}} />",
])("rejects executable repository content: %s", (source) => {
  expect(check(source)).toHaveLength(1);
});

test("reports every executable piece of a page at the line it sits on", () => {
  const tree = unified().use(remarkParse).use(remarkMdx).parse("# Setup\n\n{one()}\n\n<Card onClick={two} />\n");
  expect(executableContent(tree).map(({ place }) => place?.start.line)).toEqual([3, 5]);
});
