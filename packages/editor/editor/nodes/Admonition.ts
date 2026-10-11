import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import AdmonitionView from "./AdmonitionView";

/**
 * A Docusaurus `:::note` directive, with its body still editable.
 *
 * Unlike an inert MDX block this one has real prose inside, so it is a
 * container rather than an atom. `defining` keeps the wrapper alive when the
 * body is replaced wholesale, which is what stops a select-all-and-retype from
 * silently unwrapping the admonition.
 *
 * The `srcIndex`, `srcStart` and `srcEnd` attributes come from the shared
 * `blockOrigin` extension in `../extensions`, not from here.
 */
export const Admonition = Node.create({
  name: "admonition",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: { default: "note", rendered: false },
      title: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-admonition]",
        getAttrs: (element) => ({
          kind: element.getAttribute("data-admonition") ?? "note",
          title: element.getAttribute("data-admonition-title"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const title = node.attrs.title ? { "data-admonition-title": node.attrs.title } : {};

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-admonition": node.attrs.kind,
        ...title,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AdmonitionView);
  },
});
