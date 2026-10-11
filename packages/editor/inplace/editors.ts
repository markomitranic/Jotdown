/**
 * Every editor standing on the page, so a control outside them all can find one.
 *
 * The page-wide editor could hand its one editor to anything that needed it.
 * Here a block is its own document, so a control that floats over the article
 * rather than living inside a block — the table handles are the case this was
 * built for — has to start from the element it is pointed at and work back to
 * whichever editor owns it. A table the article drew owns no editor at all,
 * and answering null for it is the honest result rather than a miss.
 */

import type { Editor } from "@tiptap/core";

export type Editors = {
  /** Registers one editor for the life of its mount, and returns the leaving. */
  join(editor: Editor): () => void;
  /** The editor whose document this node is drawn inside, if any. */
  owning(node: Node): Editor | null;
};

/** @example const editors = createEditors(); const leave = editors.join(editor); */
export function createEditors(): Editors {
  const mounted = new Set<Editor>();

  return {
    join(editor) {
      mounted.add(editor);
      return () => mounted.delete(editor);
    },

    owning(node) {
      for (const editor of mounted) if (editor.view.dom.contains(node)) return editor;
      return null;
    },
  };
}
