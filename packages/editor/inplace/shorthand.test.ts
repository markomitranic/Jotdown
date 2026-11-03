import { describe, expect, it } from "vitest";
import { frameworkBlocks } from "@jotdown/kit";
import { shorthandFor } from "./shorthand";

const EVERY = new Set(frameworkBlocks);

describe("shorthandFor", () => {
  it("starts a list from either kind of marker", () => {
    expect(shorthandFor("- ", EVERY)?.type).toBe("bulletList");
    expect(shorthandFor("* ", EVERY)?.type).toBe("bulletList");
    expect(shorthandFor("1. ", EVERY)?.type).toBe("orderedList");
    expect(shorthandFor("4) ", EVERY)?.type).toBe("orderedList");
  });

  it("starts a list with one item to type into", () => {
    expect(shorthandFor("- ", EVERY)?.content).toEqual([{ type: "listItem", content: [{ type: "paragraph" }] }]);
  });

  it("starts a to-do list from an empty box", () => {
    expect(shorthandFor("[] ", EVERY)?.content?.[0]?.attrs).toEqual({ checked: false });
    expect(shorthandFor("[ ] ", EVERY)?.content?.[0]?.attrs).toEqual({ checked: false });
  });

  it("counts the hashes, and gives a single one the largest heading a page can hold", () => {
    expect(shorthandFor("# ", EVERY)?.attrs).toEqual({ level: 2 });
    expect(shorthandFor("## ", EVERY)?.attrs).toEqual({ level: 2 });
    expect(shorthandFor("### ", EVERY)?.attrs).toEqual({ level: 3 });
    expect(shorthandFor("#### ", EVERY)?.attrs).toEqual({ level: 4 });
    expect(shorthandFor("##### ", EVERY)).toBeNull();
  });

  it("knows the quote, the fence and the three rules that draw a divider", () => {
    expect(shorthandFor("> ", EVERY)?.type).toBe("blockquote");
    expect(shorthandFor("```", EVERY)?.type).toBe("codeBlock");
    expect(shorthandFor("---", EVERY)?.type).toBe("horizontalRule");
    expect(shorthandFor("***", EVERY)?.type).toBe("horizontalRule");
    expect(shorthandFor("___", EVERY)?.type).toBe("horizontalRule");
  });

  it("asks for nothing at all where the marker is only part of a line", () => {
    expect(shorthandFor("a - b", EVERY)).toBeNull();
    expect(shorthandFor("-", EVERY)).toBeNull();
    expect(shorthandFor("--", EVERY)).toBeNull();
    expect(shorthandFor("``", EVERY)).toBeNull();
    expect(shorthandFor("and then > ", EVERY)).toBeNull();
  });

  it("leaves the marker as typed where the page's layout does not list its block", () => {
    expect(shorthandFor("## ", new Set(["text"]))).toBeNull();
    expect(shorthandFor("- ", new Set(["bulletList"]))?.type).toBe("bulletList");
  });
});
