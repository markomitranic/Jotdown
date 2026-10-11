/**
 * The one thing Tiptap's own sink gets wrong in an editor of this shape.
 *
 * Its wrapper comes from the item's parent, which here is the document node, so
 * the step it builds puts a `doc` inside a list item and the reader's Tab does
 * nothing. What is asserted is therefore not "something happened" but *what the
 * new list is*, since a sink that nests the right item under the right one and
 * calls it the wrong type is exactly the bug.
 */

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { bodyExtensions, ITEMS } from "./editor";
import { nest } from "./indent";

const schema = getSchema(bodyExtensions(ITEMS));

/** A list of bare items, which is what a list block's own editor holds. */
function listOf(...items: string[]) {
  return schema.nodeFromJSON({
    type: "doc",
    content: items.map((text) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  });
}

/** The state with the caret inside the item at `index`. */
function caretIn(index: number, ...items: string[]) {
  const doc = listOf(...items);
  let at = 0;
  doc.forEach((item, offset, seen) => {
    if (seen === index) at = offset + 2;
  });

  return EditorState.create({ doc, selection: TextSelection.create(doc, at) });
}

describe("Tab on a list item", () => {
  it("nests the item in a list of the type the block actually is", () => {
    for (const kind of ["bulletList", "orderedList"] as const) {
      const state = caretIn(1, "one", "two");
      let after = state;

      expect(nest(state, (tr) => (after = state.apply(tr)), schema.nodes[kind])).toBe(true);

      const [first] = after.doc.toJSON().content;
      expect(first.content).toHaveLength(2);
      expect(first.content[1].type, kind).toBe(kind);
      expect(after.doc.childCount).toBe(1);
    }
  });

  it("refuses the first item, which has nothing to nest under", () => {
    const state = caretIn(0, "one", "two");

    expect(nest(state, undefined, schema.nodes.bulletList)).toBe(false);
  });

  it("joins a nesting that is already there rather than making a second one", () => {
    const state = caretIn(1, "one", "two");
    const once = state.apply(
      (() => {
        let tr = state.tr;
        nest(state, (made) => (tr = made), schema.nodes.bulletList);
        return tr;
      })(),
    );

    const [first] = once.doc.toJSON().content;
    expect(first.content.filter((node: { type: string }) => node.type === "bulletList")).toHaveLength(1);
  });
});
