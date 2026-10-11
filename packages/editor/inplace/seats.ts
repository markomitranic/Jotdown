/**
 * How one editor reports into the page's record, and how Cmd+Z reaches it.
 *
 * The seam is here rather than in the record itself because this half knows
 * what a Tiptap editor is, and the page's provider holds a record from its
 * first render. A reader who never clicks anything would otherwise download
 * every editor there is to get one.
 */

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type { History } from "./history";

/**
 * One editor's chair on the page, which outlives whoever is sitting in it.
 *
 * A block that a merge took away and an undo brought back is a new editor with
 * a schema of its own, so a change recorded against the editor that is gone has
 * to reach the one that replaced it. It remembers the chair instead, and the
 * documents it keeps are JSON for the same reason: a node built against one
 * schema belongs to nothing in another.
 */
export type Seat = {
  editor: Editor | null;
  /** The document and caret as they last stood, which is where an undo goes back to. */
  was: Snapshot;
};

type Snapshot = { doc: JSONContent; at: number };

/** An empty chair, for a block whose editor is not open yet. @example seat(); */
export function seat(): Seat {
  return { editor: null, was: { doc: { type: "doc" }, at: 0 } };
}

/**
 * Sits an editor in a chair, and reports everything it changes to the record.
 *
 * Only a transaction that moved the document is a change. A transaction that
 * only moved the caret, or one marked `addToHistory: false`, still updates the
 * chair, so that the next real change undoes to where the reader actually was.
 *
 * @example sit(part.body, editor, history);
 */
export function sit(chair: Seat, editor: Editor, history: History) {
  chair.editor = editor;
  chair.was = { doc: editor.getJSON(), at: editor.state.selection.from };

  editor.on("transaction", ({ transaction }) => {
    const at = editor.state.selection.from;

    if (!transaction.docChanged) {
      chair.was = { ...chair.was, at };
      return;
    }

    const before = chair.was;
    const after = { doc: editor.getJSON(), at };
    chair.was = after;

    if (transaction.getMeta("addToHistory") === false) return;

    history.did({ undo: () => restore(chair, before), redo: () => restore(chair, after) }, chair);
  });
}

/** Puts one editor's document and caret back the way a snapshot has them. */
function restore(chair: Seat, snapshot: Snapshot) {
  const { editor } = chair;
  if (editor === null || editor.isDestroyed) return;

  const { view } = editor;
  const { content } = view.state.schema.nodeFromJSON(snapshot.doc);
  const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, content);

  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(snapshot.at, tr.doc.content.size))));
  view.dispatch(tr);
  view.focus();
}

/**
 * The undo keys, answered by the page rather than by the block they were pressed in.
 *
 * They report handled whether or not there was anything to undo, because the
 * alternative is the browser's own undo running on a `contenteditable` the view
 * believes it owns, which puts the DOM and the document out of step.
 *
 * @example new Editor({ extensions: [...body, pageHistory(history)] });
 */
export function pageHistory(history: History) {
  return Extension.create({
    name: "pageHistory",
    priority: 1100,

    addKeyboardShortcuts() {
      return {
        "Mod-z": () => {
          history.undo();
          return true;
        },
        "Shift-Mod-z": () => {
          history.redo();
          return true;
        },
        "Mod-y": () => {
          history.redo();
          return true;
        },
      };
    },
  });
}
