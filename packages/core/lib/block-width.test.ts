import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import type { Root } from "mdast";
import { peelWidth, remarkBlockWidth, WIDTH, wrapWidth } from "./block-width";

function widened(markdown: string) {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkBlockWidth);
  return processor.runSync(processor.parse(markdown)) as Root;
}

const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |";

describe("remarkBlockWidth", () => {
  it("hands a top-level width to the table it wraps, with the wrapper's position", () => {
    const [table] = widened(`:::wide\n\n${TABLE}\n\n:::`).children;

    expect(table?.type).toBe("table");
    expect(table?.data?.hProperties?.[WIDTH]).toBe("wide");
    expect(table?.position?.start.line).toBe(1);
    expect(table?.position?.end.line).toBe(7);
  });

  it("widens a paragraph holding only an image", () => {
    const [image] = widened(":::full\n\n![Map](/map.png)\n\n:::").children;

    expect(image?.type).toBe("paragraph");
    expect(image?.data?.hProperties?.[WIDTH]).toBe("full");
  });

  it("drops a width around anything else, keeping what was inside", () => {
    const tree = widened(":::wide\n\nWords.\n\n:::");

    expect(tree.children.map((node) => node.type)).toEqual(["paragraph"]);
    expect(tree.children[0]?.data?.hProperties).toBeUndefined();
  });

  it("drops a width that is not at the top level", () => {
    const tree = widened(`::::note\n\n:::wide\n\n${TABLE}\n\n:::\n\n::::`);
    const [note] = tree.children;

    expect(note?.type).toBe("containerDirective");
    expect(note?.type === "containerDirective" && note.children.map((node) => node.type)).toEqual(["table"]);
  });
});

describe("peelWidth", () => {
  it("is undone by wrapWidth", () => {
    const written = `:::wide\n\n${TABLE}\n\n:::`;
    const { width, inner } = peelWidth(written);

    expect(inner).toBe(TABLE);
    expect(wrapWidth(inner, width)).toBe(written);
  });

  it("leaves a block with no width alone", () => {
    expect(peelWidth(TABLE)).toEqual({ width: "normal", inner: TABLE });
    expect(peelWidth(":::note\n\nCareful.\n\n:::").width).toBe("normal");
  });
});
