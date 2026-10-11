/**
 * Where the reader is on the page, and which block's editor is holding them.
 *
 * Every block is its own little document, so there is no single selection for
 * a floating control to read. This is where each one reports its own, and the
 * controls that live outside the article — the menu beside a
 * selection, the `+` beside an empty line — read whichever report is current
 * rather than owning an editor of their own. Both are answered here because
 * both are the same question: a caret is a selection that happens to be empty,
 * and a control interested in one filters for it.
 *
 * Visibility follows the selection, not the browser's own focus. Opening the
 * menu's link field moves real focus to a plain `<input>`, which blurs the
 * editor without changing its document at all, and a tracker that cleared
 * itself on blur would close that field the instant it opened. So a report
 * only ever asks the editor's own `state.selection`, and the most recent one
 * anywhere on the page stands until another arrives.
 *
 * Only the editor holding focus, or the one already reported, reports. Every
 * editor runs transactions of its own, mounting or taking an undo, and one
 * that reported from elsewhere on the page would take the selection away from
 * the reader, while the reader's own editor must keep reporting when a menu
 * beside it holds focus and changes it.
 */

import type { Editor } from "@tiptap/core";

/**
 * One editor's selection. `text` is whether it covers any words, which a block
 * selected whole, such as an image resting in its own editor, never does.
 */
export type Selected = { editor: Editor; from: number; to: number; empty: boolean; text: boolean };

export type SelectionTracker = {
  /** Lets one editor report its own selection as it changes, and returns the leaving. */
  join(editor: Editor): () => void;
  get(): Selected | null;
  /** Forgets the current report, for a selection that has left every editor. */
  clear(): void;
  subscribe(fn: () => void): () => void;
};

/** @example const selection = createSelectionTracker(); const leave = selection.join(editor); */
export function createSelectionTracker(): SelectionTracker {
  let current: Selected | null = null;
  const subscribers = new Set<() => void>();
  const notify = () => subscribers.forEach((fn) => fn());

  return {
    join(editor) {
      const report = () => {
        if (current?.editor !== editor && !editor.view.hasFocus()) return;

        const { empty, from, to } = editor.state.selection;
        const text = !empty && editor.state.doc.textBetween(from, to).trim() !== "";
        current = { editor, from, to, empty, text };
        notify();
      };

      editor.on("transaction", report);

      return () => {
        editor.off("transaction", report);

        if (current?.editor === editor) {
          current = null;
          notify();
        }
      };
    },

    get: () => current,

    clear() {
      current = null;
      notify();
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
