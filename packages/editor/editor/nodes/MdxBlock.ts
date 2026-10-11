import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MdxBlockView from "./MdxBlockView";

/**
 * An MDX construct the editor shows but refuses to edit.
 *
 * Imports, JSX elements and expressions have no sensible WYSIWYG form, and
 * guessing at one would corrupt the file. So they become atoms: one unit to
 * select, one unit to delete, otherwise untouchable. `source` is the verbatim
 * slice of the original file and is never rewritten, which is what lets the
 * bridge splice these blocks back byte for byte.
 *
 * The `srcIndex`, `srcStart` and `srcEnd` attributes come from the shared
 * `blockOrigin` extension in `../extensions`, not from here.
 */
export const MdxBlock = Node.create({
  name: "mdxBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      source: { default: "", rendered: false },
      kind: { default: "unknown", rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-mdx-block]",
        getAttrs: (element) => ({
          kind: element.getAttribute("data-mdx-block") ?? "unknown",
          source: element.textContent ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-mdx-block": node.attrs.kind }),
      ["pre", {}, node.attrs.source],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MdxBlockView);
  },
});
