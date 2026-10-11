import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AccordionsView, AccordionView } from "./AccordionsView";

/**
 * The `<Accordions>` wrapper, which holds panels and nothing else.
 *
 * `type` is the single-or-multiple prop of `Accordions`, carried through untouched
 * because nothing in the editor reads it. Which panel greets the reader open is
 * the panel's own `open` attribute rather than the wrapper's `defaultValue`, so
 * renaming a title cannot leave the wrapper pointing at a panel that is gone.
 *
 * `srcIndex`, `srcStart` and `srcEnd` come from the shared `blockOrigin`
 * extension in `../extensions`, not from here.
 */
export const Accordions = Node.create({
  name: "accordions",
  group: "block",
  content: "accordion+",
  defining: true,

  addAttributes() {
    return { type: { default: null, rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-accordions]",
        getAttrs: (element) => ({ type: element.getAttribute("data-accordions") || null }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-accordions": node.attrs.type ?? "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionsView);
  },
});

/**
 * One titled panel, with its prose still editable.
 *
 * `isolating` is what keeps a backspace at the top of a panel from swallowing
 * the panel above it, the same reason a table cell carries it. The title lives
 * in an attribute rather than as a first child, because `Accordion` reads it as a
 * prop and it is one line of plain text either way.
 */
export const Accordion = Node.create({
  name: "accordion",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: { default: "", rendered: false },
      id: { default: null, rendered: false },
      open: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-accordion]",
        getAttrs: (element) => ({
          title: element.getAttribute("data-accordion") ?? "",
          id: element.getAttribute("data-accordion-id"),
          open: element.hasAttribute("data-accordion-open"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-accordion": node.attrs.title ?? "",
        ...(node.attrs.id === null ? {} : { "data-accordion-id": node.attrs.id }),
        ...(node.attrs.open === true ? { "data-accordion-open": "" } : {}),
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionView);
  },
});
