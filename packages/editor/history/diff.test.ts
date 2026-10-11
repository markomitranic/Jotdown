import { expect, test } from "vitest";
import { compareMarkdown } from "./diff";

test("counts restore changes and keeps the two sets of line numbers aligned", () => {
  expect(compareMarkdown("heading\nnew\ntail\n", "heading\nold\nextra\ntail\n")).toEqual({
    added: 2,
    removed: 1,
    rows: [
      { kind: "same", text: "heading", before: 1, after: 1 },
      { kind: "removed", text: "new", before: 2, after: null },
      { kind: "added", text: "old", before: null, after: 2 },
      { kind: "added", text: "extra", before: null, after: 3 },
      { kind: "same", text: "tail", before: 3, after: 4 },
    ],
  });
});

test("handles empty versions and ignores CRLF differences only for display", () => {
  expect(compareMarkdown("", "")).toEqual({ added: 0, removed: 0, rows: [] });
  expect(compareMarkdown("line\r\n", "line\n")).toMatchObject({ added: 0, removed: 0 });
  expect(compareMarkdown("line\n", "")).toMatchObject({ added: 0, removed: 1 });
  expect(compareMarkdown("", "line")).toMatchObject({ added: 1, removed: 0 });
});

test("bounds expensive comparisons", () => {
  expect(compareMarkdown("x\n".repeat(20_001), "")).toBeNull();
  expect(compareMarkdown("a".repeat(1_000_001), "")).toBeNull();
});
