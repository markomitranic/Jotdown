import { describe, expect, it } from "vitest";
import { shorthandFor } from "./shorthand";

describe("shorthandFor", () => {
  it("starts a list from either kind of marker", () => {
    expect(shorthandFor("- ")?.type).toBe("bulletList");
    expect(shorthandFor("* ")?.type).toBe("bulletList");
    expect(shorthandFor("1. ")?.type).toBe("orderedList");
    expect(shorthandFor("4) ")?.type).toBe("orderedList");
  });

  it("starts a list with one item to type into", () => {
    expect(shorthandFor("- ")?.content).toEqual([{ type: "listItem", content: [{ type: "paragraph" }] }]);
  });

  it("counts the hashes, and gives a single one the largest heading a page can hold", () => {
    expect(shorthandFor("# ")?.attrs).toEqual({ level: 2 });
    expect(shorthandFor("## ")?.attrs).toEqual({ level: 2 });
    expect(shorthandFor("### ")?.attrs).toEqual({ level: 3 });
    expect(shorthandFor("#### ")?.attrs).toEqual({ level: 4 });
    expect(shorthandFor("##### ")).toBeNull();
  });

  it("knows the quote, the fence and the three rules that draw a divider", () => {
    expect(shorthandFor("> ")?.type).toBe("blockquote");
    expect(shorthandFor("```")?.type).toBe("codeBlock");
    expect(shorthandFor("---")?.type).toBe("horizontalRule");
    expect(shorthandFor("***")?.type).toBe("horizontalRule");
    expect(shorthandFor("___")?.type).toBe("horizontalRule");
  });

  it("asks for nothing at all where the marker is only part of a line", () => {
    expect(shorthandFor("a - b")).toBeNull();
    expect(shorthandFor("-")).toBeNull();
    expect(shorthandFor("--")).toBeNull();
    expect(shorthandFor("``")).toBeNull();
    expect(shorthandFor("and then > ")).toBeNull();
  });
});
