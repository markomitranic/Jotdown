/**
 * Proves the markdown bridge and the in-place editors' schemas agree.
 *
 * The bridge's own tests go from source text to a document and back with no
 * ProseMirror in the middle, so they cannot see the one failure that would
 * quietly ruin every save: ProseMirror drops any attribute a node type has not
 * declared and fills a default for every one it has, so a node view that forgot
 * to declare something the printer reads would rewrite its block the moment an
 * editor opened on it, and the diff would be a file nobody can review.
 *
 * What is run here is exactly what a page does. Every top-level block of a real
 * fixture is parsed, handed to the schema the editor that block would get
 * carries, and printed back, which is `planFor`, `mount` and `print` with the
 * browser left out.
 */

import { describe, expect, test } from "vitest";
import { getSchema } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { parseDocument } from "../markdown/parse";
import { printBlock } from "../markdown/fromProseMirror";
import { fixtures } from "../fixtures";
import { bodyExtensions, holdsFor } from "./editor";
import { isSolo, soloExtensions } from "./solo";

/**
 * One block through the schema its own editor would use, and back to markdown.
 *
 * A block the article drew hands its *children* to an editor mounted on the
 * element the core made, so the schema sees the children and the block's own
 * attributes never leave this side. A block with no editor at all comes back
 * untouched, which is what the page does with it too.
 */
function printed(block: JSONContent): string {
  const type = block.type ?? "";

  if (isSolo(type)) {
    const schema = getSchema(soloExtensions(type));
    const doc = Node.fromJSON(schema, { type: "doc", content: [block] }).toJSON() as JSONContent;
    return printBlock((doc.content ?? [])[0]!);
  }

  const holds = holdsFor(type);
  if (holds === undefined) return printBlock(block);

  const schema = getSchema(bodyExtensions(holds));
  const doc = Node.fromJSON(schema, {
    type: "doc",
    content: block.content ?? [],
  }).toJSON() as JSONContent;

  return printBlock({ ...block, content: doc.content ?? [] });
}

/**
 * The question is what the schema changes, so the printer is both sides of it.
 *
 * Comparing against the file instead would fail on every hard-wrapped
 * paragraph in the repository, because a soft break is a space and the printer
 * writes the space, which is the reflow recorded as still unfinished and is not
 * this test's business. `markdown.test.ts` is where the printer is held to the
 * bytes.
 */
describe("the schemas change nothing the printer would have said", () => {
  test.each(fixtures)("$name comes back through its editors unchanged", ({ source }) => {
    for (const block of parseDocument(source).doc.content ?? []) {
      expect(printed(block), `${block.type}`).toBe(printBlock(block));
    }
  });
});

describe("a table keeps what only its cells know", () => {
  const source = [
    "| Role | The job |",
    "| --- | :---: |",
    "| Gateway | One vendor |",
    "| Adapter | One endpoint |",
  ].join("\n");

  test("alignment survives, so a table does not drag itself into the diff", () => {
    const table = (parseDocument(source).doc.content ?? [])[0]!;
    expect(printed(table)).toBe(source);
    expect(printed(table)).toContain("| --- | :---: |");
  });

  test("a cell holds one paragraph and no more", () => {
    const schema = getSchema(soloExtensions("table"));
    expect(schema.nodes.tableCell!.spec.content).toBe("paragraph");
    expect(schema.nodes.tableHeader!.spec.content).toBe("paragraph");
  });
});
