/**
 * The keys that reach past the end of one block, and the questions they ask first.
 *
 * Every editable block is its own document, so ProseMirror's own answer to Down
 * on the last line, Enter at the end, or Backspace on the first character is
 * "there is nothing there". These handlers run before the built-in ones, decide
 * whether the caret really is at an edge, and hand the move to whoever knows
 * what sits beside this block. Anywhere but an edge they decline, and the
 * ordinary editing keys do what they always did.
 *
 * The same edges are where a caret gives way to a selection of whole blocks,
 * so the keys that make one live here too.
 */

import { Extension, type Editor } from "@tiptap/core";
import { Selection, type EditorState } from "@tiptap/pm/state";
import type { Direction } from "./roster";
import { blockOf, meant, siblingsOf, type BlockSelection } from "./blockSelection";
import type { Handles } from "./handles";
import { caretElement, letGo } from "./selectBlocks";

/** What a block's neighbourhood can do for it, each returning whether it did. */
export type Moves = {
  /** Move the caret into the block before or after this one, keeping its column if asked. */
  step(editor: Editor, direction: Direction, keepColumn: boolean): boolean;
  /** Put the rest of this block, or a fresh empty one, into a new block below. */
  split(editor: Editor): boolean;
  /** Fold this block onto the end of the one above it. */
  merge(editor: Editor): boolean;
  /** Outdent this list item, or take it out of the list when it is already top level. */
  unlist(editor: Editor): boolean;
};

/**
 * A keymap that turns the edges of one small document into the page's own edges.
 *
 * The priority is what puts these handlers in front of `StarterKit`'s. Enter
 * has to be asked first or `splitBlock` would answer inside a list item that
 * the reader is trying to leave, and Backspace has to be asked first or
 * `joinBackward` would delete a character it thinks is there.
 *
 * @example new Editor({ extensions: [...body, crossBlock(moves)] });
 */
export function crossBlock(moves: Moves) {
  return Extension.create({
    name: "crossBlock",
    priority: 1000,

    addKeyboardShortcuts() {
      return {
        ArrowUp: ({ editor }) => onFirstLine(editor) && moves.step(editor, -1, true),
        ArrowDown: ({ editor }) => onLastLine(editor) && moves.step(editor, 1, true),
        ArrowLeft: ({ editor }) => atStart(editor.state) && moves.step(editor, -1, false),
        ArrowRight: ({ editor }) => atEnd(editor.state) && moves.step(editor, 1, false),
        Backspace: ({ editor }) =>
          (atStart(editor.state) && moves.merge(editor)) || (atItemStart(editor.state) && moves.unlist(editor)),
        Enter: ({ editor }) => moves.split(editor),
      };
    },
  });
}

/**
 * Whether the caret sits on the document's first visual line.
 *
 * Two questions, because a wrapped paragraph has several lines and only one of
 * them is the top one. `endOfTextblock` is ProseMirror's own reading of the
 * browser's line boxes, which is the only thing that knows where a wrap fell,
 * and the first half rules out a caret that is on the top line of some later
 * block inside the same document.
 */
function onFirstLine(editor: Editor): boolean {
  return inEdgeTextblock(editor.state, -1) && editor.view.endOfTextblock("up");
}

function onLastLine(editor: Editor): boolean {
  return inEdgeTextblock(editor.state, 1) && editor.view.endOfTextblock("down");
}

/** Whether the caret's own textblock is the first or last one in its document. */
function inEdgeTextblock(state: EditorState, direction: Direction): boolean {
  const { $from, empty } = state.selection;
  if (!empty) return false;

  return direction === -1
    ? $from.start() === Selection.atStart(state.doc).from
    : $from.end() === Selection.atEnd(state.doc).to;
}

/** Whether the caret sits on the very first character position of the document. */
function atStart(state: EditorState): boolean {
  return state.selection.empty && state.selection.from === Selection.atStart(state.doc).from;
}

function atEnd(state: EditorState): boolean {
  return state.selection.empty && state.selection.to === Selection.atEnd(state.doc).to;
}

/**
 * Whether the caret sits on the first character of a list item's own paragraph.
 *
 * A different question from `atStart`, which is about the whole document. The
 * second and third items of a list are at the start of an item without being
 * anywhere near the start of the document, and they are exactly where the
 * built-in Backspace chain misbehaves.
 */
function atItemStart(state: EditorState): boolean {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 2 || $from.parentOffset !== 0) return false;

  const item = $from.depth - 1;
  return $from.node(item).type.name === "listItem" && $from.index(item) === 0;
}

/**
 * The keys that turn the block holding the caret into a block selection.
 *
 * Escape selects the block, as it does in Notion. Shift with Up or Down, once
 * the text is selected as far as that end of the block, selects the block and
 * the one beside it. Select All in a block already wholly selected selects the
 * whole article. Each lets go of the caret, so the next key reaches the blocks.
 *
 * Escape and Shift sit below the default priority on purpose: the slash menu
 * and the link field answer Escape themselves while they are open, and they
 * must be asked first. Select All sits above it, because the editor's own
 * keymap selects the document and would never hand the key on.
 *
 * @example new Editor({ extensions: [...body, ...pickKeys(page)] });
 */
export function pickKeys({ blocks, handles }: { blocks: BlockSelection; handles: Handles }) {
  const pick = (editor: Editor, toward?: Direction) => {
    const caret = blockOf(handles, caretElement(editor));
    if (caret === null) return false;

    const here = meant(handles, caret);
    const siblings = siblingsOf(handles, here);
    blocks.select(here, toward === undefined ? here : (siblings[siblings.indexOf(here) + toward] ?? here));
    letGo(editor);
    return true;
  };

  const pickAll = (editor: Editor) => {
    if (!wholly(editor.state)) return false;

    blocks.all();
    letGo(editor);
    return true;
  };

  return [
    Extension.create({
      name: "pickKeys",
      priority: 50,

      addKeyboardShortcuts() {
        return {
          Escape: ({ editor }) => pick(editor),
          "Shift-ArrowUp": ({ editor }) => headAtEdge(editor.state, -1) && pick(editor, -1),
          "Shift-ArrowDown": ({ editor }) => headAtEdge(editor.state, 1) && pick(editor, 1),
        };
      },
    }),
    Extension.create({
      name: "pickAll",
      priority: 1000,

      addKeyboardShortcuts() {
        return { "Mod-a": ({ editor }) => pickAll(editor) };
      },
    }),
  ];
}

/** Whether the moving end of the selection already sits at the very start or end of the document. */
function headAtEdge(state: EditorState, direction: Direction): boolean {
  const { head } = state.selection;
  return direction === -1 ? head === Selection.atStart(state.doc).from : head === Selection.atEnd(state.doc).to;
}

/** Whether the selection already covers the whole document, as it does in an empty one. */
function wholly(state: EditorState): boolean {
  const { from, to } = state.selection;
  return from <= Selection.atStart(state.doc).from && to >= Selection.atEnd(state.doc).to;
}
