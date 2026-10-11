import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { printBlock } from "../markdown/fromProseMirror";
import { bodyExtensions, holdsFor } from "./editor";
import { blockFor, inplaceChoices, type InplaceBlock } from "./slash";
import { isSolo, soloExtensions } from "./solo";

/** Every block the menu builds out of nothing, named as `blockFor` takes it. */
const KINDS: InplaceBlock[] = [
  "paragraph",
  "heading2",
  "heading3",
  "heading4",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "note",
  "tip",
  "info",
  "warning",
  "caution",
  "danger",
  "source",
  "codeBlock",
  "mermaid",
  "whiteboard",
  "table",
  "videoEmbed",
  "accordions",
  "steps",
  "tabs",
  "cards",
  "files",
];

/**
 * The same question `mountBlock` asks before it opens an editor.
 *
 * Handed a node it has never heard of, Tiptap warns and mounts an *empty*
 * editor, which on the page reads as the block somebody just inserted vanishing
 * as they insert it. Asking the schema here is what keeps that out of a browser.
 */
function holdable(block: ReturnType<typeof blockFor>) {
  const type = block.type as string;

  if (isSolo(type)) {
    const schema = getSchema(soloExtensions(type));
    return () => schema.nodeFromJSON({ type: "doc", content: [block] }).check();
  }

  const holds = holdsFor(type);
  if (holds === undefined) return () => {};

  const schema = getSchema(bodyExtensions(holds));
  return () => schema.nodeFromJSON({ type: "doc", content: block.content ?? [] }).check();
}

describe("a block the slash menu inserts", () => {
  it.each(KINDS)("is one its own editor's schema will hold: %s", (kind) => {
    expect(holdable(blockFor(kind))).not.toThrow();
  });
});

describe("what an inserted block says in the file", () => {
  it("writes a fence the reader's pipeline will highlight after a rebuild", () => {
    expect(printBlock(blockFor("codeBlock"))).toBe("```\n```");
    expect(printBlock(blockFor("mermaid"))).toBe("```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```");
  });

  it("writes a table at the size that was asked for, header row and all", () => {
    expect(printBlock(blockFor("table", { rows: 2, cols: 2 }))).toBe("| | |\n| --- | --- |\n| | |");
  });

  it("writes the layout tags the pages here already use", () => {
    expect(printBlock(blockFor("cards"))).toBe("<Cards>\n  <Card />\n  <Card />\n</Cards>");
    expect(printBlock(blockFor("files"))).toBe("<Files>\n  <Folder defaultOpen>\n    <File />\n  </Folder>\n</Files>");
    expect(printBlock(blockFor("tabs"))).toContain("<Tabs items={['', '']}>");
  });

  it("leaves no trace of a video nobody pasted a link into", () => {
    expect(printBlock(blockFor("videoEmbed"))).toBe("");
  });
});

describe("every item on the menu", () => {
  it("builds a block, picks a file or pastes markdown, and nothing else", () => {
    for (const item of inplaceChoices({ mdx: true }, "")) {
      if ("pastes" in item || "writes" in item) continue;
      if ("picks" in item) {
        expect(item.picks).toMatch(/^(image|file)$/);
        continue;
      }
      expect(holdable(blockFor(item.block))).not.toThrow();
    }
  });
});
