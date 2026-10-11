/**
 * Tab and Shift-Tab on a list item, for an editor whose document *is* the list.
 *
 * Tiptap binds Tab to `sinkListItem` already, and here it can never work. The
 * command builds the list it is about to nest by asking the item's parent what
 * type it is, which in a page-wide editor is the `bulletList` around it. Every
 * editor on this page holds one block's children instead, so a list's editor is
 * a document of bare `listItem`s and that parent is the document node: the
 * command tries to put a `doc` inside a list item, and a reader pressing Tab
 * gets nothing at all.
 *
 * So the wrapper is named rather than discovered. The block already knows which
 * list it is, because the article drew it, and that is the one thing the stock
 * command was missing. Everything else is its own: the first item of a list has
 * nothing to nest under and refuses, and Shift-Tab is the stock lift, which
 * walks the list structure and never asks the document what it is.
 */

import { Extension } from "@tiptap/core";
import { Fragment, Slice, type NodeType } from "@tiptap/pm/model";
import { ReplaceAroundStep } from "@tiptap/pm/transform";
import type { EditorState, Transaction } from "@tiptap/pm/state";

/** The two list types a block can be, which is also what the article drew it as. */
export type ListKind = "bulletList" | "orderedList";

/**
 * Binds Tab to nest a list item one level deeper, and Shift-Tab to lift it back.
 *
 * @example listIndent("orderedList") // Tab nests into a new <ol>
 */
export function listIndent(kind: ListKind) {
  return Extension.create({
    name: "listIndent",
    priority: 1000,

    addKeyboardShortcuts() {
      return {
        Tab: ({ editor }) => nest(editor.state, editor.view.dispatch, editor.schema.nodes[kind]),
        "Shift-Tab": ({ editor }) => editor.commands.liftListItem("listItem"),
      };
    },
  });
}

/**
 * Nests the item the caret is in inside a new list under the item before it.
 *
 * `prosemirror-schema-list`'s own sink, with the one line that reads the list
 * type off the parent replaced by the type passed in. The shape of the step is
 * the library's and is left alone: a nesting that already exists is joined
 * rather than doubled, which is what the depth of three counts.
 */
export function nest(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  list: NodeType | undefined,
): boolean {
  const item = state.schema.nodes.listItem;
  if (list === undefined || item === undefined) return false;

  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, (node) => node.childCount > 0 && node.firstChild?.type === item);
  if (range === null || range.startIndex === 0) return false;

  const before = range.parent.child(range.startIndex - 1);
  if (before.type !== item) return false;

  if (dispatch) {
    const joins = before.lastChild?.type === list;
    const inner = Fragment.from(joins ? item.create() : null);
    const slice = new Slice(
      Fragment.from(item.create(null, Fragment.from(list.create(null, inner)))),
      joins ? 3 : 1,
      0,
    );

    dispatch(
      state.tr
        .step(new ReplaceAroundStep(range.start - (joins ? 3 : 1), range.end, range.start, range.end, slice, 1, true))
        .scrollIntoView(),
    );
  }

  return true;
}
