import { describe, expect, it } from "vitest";
import { printBlock } from "../markdown/fromProseMirror";
import { rangeIn } from "@jotdown/core/lib/source-range";
import { endOfFile, flowOf } from "./still";

/**
 * A stand-in for a run of nested elements, innermost first.
 *
 * Finding a block's own frame asks an element only who its parent is, how many
 * children that parent has and whether it carries a stamp, so a chain of plain
 * objects answers exactly as a page would.
 */
function nested(children: number[], stamped = -1) {
  let parent: HTMLElement | null = null;

  return children.map((childElementCount, depth) => {
    const element = {
      parentElement: parent,
      childElementCount,
      hasAttribute: () => depth === stamped,
    } as unknown as HTMLElement;

    parent = element;
    return element;
  });
}

describe("flowOf", () => {
  it("lifts a stamped block to the frame drawn around it alone", () => {
    const [container, body, frame, table] = nested([3, 4, 1, 0]);

    expect(flowOf(table!, container!)).toBe(frame);
  });

  it("stops at the first element with something beside it", () => {
    const [container, body, figure] = nested([3, 4, 0]);

    expect(flowOf(figure!, container!)).toBe(figure);
  });

  it("never lifts as far as a chapter of the article, however few blocks it holds", () => {
    const [container, body, onlyBlock] = nested([1, 1, 0]);

    expect(flowOf(onlyBlock!, container!)).toBe(onlyBlock);
  });
});

describe("a block with no editor", () => {
  it("prints back the bytes it was written as, whatever they are", () => {
    const source = '```ts title="x.ts" lineNumbers\nconst a = { b: 1 };\n```';

    expect(printBlock({ type: "mdxBlock", attrs: { source } })).toBe(source);
  });

  it("keeps a table's own alignment rather than reflowing it", () => {
    const source = "| Want |  Do  |\n| ---- | :--: |\n| a    |  b   |";

    expect(printBlock({ type: "mdxBlock", attrs: { source } })).toBe(source);
  });
});

describe("endOfFile", () => {
  it("stamps the empty range after the last byte, where a new page's first block is written", () => {
    const source = "---\ntitle: New\n---\n";
    const stamp = endOfFile(source);
    expect(stamp).toBe("4:1-4:1");
    expect(rangeIn(source, stamp)).toEqual({ start: source.length, end: source.length });
  });
});
