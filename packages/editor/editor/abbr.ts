import { Mark } from "@tiptap/core";

/**
 * Inline `<abbr title="...">` elements from the docs.
 *
 * Renders as a native `<abbr>` in the editing surface so the browser shows its
 * tooltip on hover. The mark carries the `title` through the ProseMirror model
 * and the serializer writes it back as inline HTML.
 */
export const Abbr = Mark.create({
  name: "abbr",

  addAttributes() {
    return { title: { default: null } };
  },

  parseHTML() {
    return [{ tag: "abbr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["abbr", HTMLAttributes, 0];
  },
});
