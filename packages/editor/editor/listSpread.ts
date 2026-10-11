import { Extension } from "@tiptap/core";

/** The class a list written without blank lines between its items is drawn with. */
export const TIGHT_LIST = "jd-list-tight";

/**
 * Whether a list is written with a blank line between its items.
 *
 * Markdown calls that a loose list, and it is the author's choice rather than a
 * rendering detail: a list that reads with air around each item should still
 * read that way after somebody fixes a typo in it. Without this the schema has
 * nowhere to keep the answer, so every list a reader touched came back tight
 * and the whole block showed up in the diff.
 *
 * The lists also say it in the DOM, because the two are drawn differently and
 * the editor cannot draw either one. Markdown renders a tight item as bare text
 * in its `<li>` and a loose one wrapped in a `<p>`, which is what the article's
 * spacing is built on; ProseMirror wraps every item, so a tight list handed to
 * an editor would suddenly wear a loose list's margins. The class is what the
 * stylesheet takes them back off with.
 *
 * An item keeps the bit too, unrendered: a single item can be loose inside a
 * tight list, and only markdown has anywhere to put that.
 */
export const listSpread = Extension.create({
  name: "listSpread",

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          spread: {
            default: false,
            keepOnSplit: false,
            parseHTML: (element) => !element.classList.contains(TIGHT_LIST),
            renderHTML: (attributes) => (attributes.spread ? {} : { class: TIGHT_LIST }),
          },
        },
      },
      {
        types: ["listItem"],
        attributes: { spread: { default: false, rendered: false, keepOnSplit: false } },
      },
    ];
  },
});
