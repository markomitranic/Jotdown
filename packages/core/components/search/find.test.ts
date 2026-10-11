import { expect, test } from "vitest";
import type { SearchDocument } from "@jotdown/core/server/search";
import { findLiteral, fromRanked, queryPattern } from "./find";
import { targetLine } from "./SourcePreview";

const guide: SearchDocument = {
  id: "/guide",
  url: "/guide",
  path: "guide.mdx",
  markdownUrl: "/llms.mdx/guide",
  title: "Guide",
  tag: "",
  structuredData: {
    headings: [{ id: "setup", content: "Setup" }],
    contents: [{ heading: "setup", content: "Run the Setup script, then the setup wizard." }],
  },
};

const options = { matchCase: false, words: false, regex: false };

test("reads the query as text once an option is on", () => {
  const texts = (pattern: RegExp | null) => findLiteral([guide], pattern!).map((match) => match.text);

  expect(texts(queryPattern("Setup", { ...options, matchCase: true }))).toEqual([
    "Setup",
    "Run the Setup script, then the setup wizard.",
  ]);
  expect(texts(queryPattern("set", { ...options, words: true }))).toEqual([]);
  expect(texts(queryPattern("script|wizard", { ...options, regex: true }))).toEqual([
    "Run the Setup script, then the setup wizard.",
  ]);
  expect(queryPattern("(", { ...options, regex: true })).toBeNull();
});

test("lists a ranked page on its own only when none of its headings or paragraphs matched", () => {
  const ranked = [
    { id: "/guide", url: "/guide", type: "page" as const, content: "Guide" },
    { id: "/guide-0", url: "/guide#setup", type: "heading" as const, content: "<mark>Setup</mark>" },
  ];

  expect(fromRanked(ranked, new Map([["/guide", guide]])).map((match) => [match.kind, match.text])).toEqual([
    ["heading", "Setup"],
  ]);
});

test("previews a paragraph at its line under its heading, past the front matter", () => {
  const lines = [
    "---",
    "title: Guide",
    "---",
    "",
    "Setup comes later.",
    "",
    "## Setup",
    "",
    "Run the **Setup** script,",
    "then the setup wizard.",
  ];
  const paragraph = findLiteral([guide], /wizard/gi)[0]!;

  expect(targetLine(lines, paragraph, /wizard/gi)).toBe(9);
});
