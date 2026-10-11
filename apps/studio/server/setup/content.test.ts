import { expect, test } from "vitest";
import { asideMoves, classify } from "./content";

test("only docs/ is in the way at the repository root, and everything in a folder of its own", () => {
  expect(classify(["src", "docs", "package.json"], true)).toEqual({ kind: "occupied", entries: ["docs"], count: 1 });
  expect(classify(["src", "package.json"], true)).toEqual({ kind: "clear" });
  expect(classify(["notes.md", ".DS_Store", "_old"], false)).toEqual({
    kind: "occupied",
    entries: ["notes.md"],
    count: 1,
  });
});

test("what is in the way moves into _old inside the content folder, only when asked", () => {
  expect(asideMoves("", ["src", "docs"], true)).toEqual([{ from: "docs", to: "_old/docs" }]);
  expect(asideMoves("apps/docs", ["notes.md"], true)).toEqual([
    { from: "apps/docs/notes.md", to: "apps/docs/_old/notes.md" },
  ]);
  expect(asideMoves("", ["docs"], false)).toEqual([]);
});
