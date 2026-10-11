import { expect, test } from "vitest";
import { containsGenerated, holdsGenerated, isGeneratedPage } from "./generated";

test("a handwritten section can be renamed but cannot move its generated children", () => {
  const docs = {
    "/api": { source: "docs/api/index.mdx", title: "API" },
    "/api/reference": { source: "docs/api/reference.mdx", title: "Reference", generated: true },
  };
  expect(isGeneratedPage(docs, "docs/api")).toBe(false);
  expect(containsGenerated(docs, "docs/api")).toBe(true);
  expect(isGeneratedPage(docs, "docs/api/reference.mdx")).toBe(true);
  expect(containsGenerated(docs, "docs/api-v2")).toBe(false);
});

test("nothing can be dropped among generated pages, but the folders above them stay open", () => {
  const docs = {
    "/changelog/v2": { source: "docs/changelog/v2.md", title: "v2", generated: true },
  };
  expect(holdsGenerated(docs, "docs/changelog")).toBe(true);
  expect(holdsGenerated(docs, "docs")).toBe(false);
});
