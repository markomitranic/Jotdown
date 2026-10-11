/**
 * Everything the editor knows about tables, narrowed to what markdown can hold.
 *
 * A GFM table is one line of the file per row. That single fact decides the rest
 * of this file: a cell takes one paragraph and no more, there is a header row
 * and never a footer, and column widths have nowhere to be written down.
 *
 * The rearranging half comes in two layers. `reorderRows` and `reorderColumns`
 * are pure functions over the table's JSON, and the commands underneath them
 * are the adapter: they find the table, aim the selection, and dispatch.
 */

import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Node } from "@tiptap/pm/model";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import type { Editor, JSONContent, Range } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

/** How many boxes the size grid draws in each direction. */
export const GRID_MAX = 8;

/** A table size, rows counted including the header row. */
export type GridSize = { rows: number; cols: number };

/** A table in the document: the node, where it starts, and its shape. */
export type TableTarget = { node: Node; pos: number; rows: number; cols: number };

/**
 * The four table nodes, configured for markdown.
 *
 * Cells hold exactly one paragraph. A cell that could hold two paragraphs, or a
 * list, would let someone build a table the save cannot print. Resizing is off
 * for the same reason: a dragged column width would be lost on the next save,
 * which reads as the editor forgetting what you did.
 */
export const tableNodes = tableNodesFor(false);

/**
 * The same four nodes, for a table standing in the scrolling box the build drew.
 *
 * Tiptap wraps a table in a `div.tableWrapper` of its own for the horizontal
 * scroll; inside the build's box that would be a second one, so the wrapper and
 * the node view that draws it are both off and the `<table>` is drawn bare.
 *
 * @example tableNodesFor(true); // for an editor mounted in the build's box
 */
export function tableNodesFor(inFrame: boolean) {
  return [
    Table.configure({ resizable: false, ...(inFrame ? { renderWrapper: false, View: null } : {}) }),
    TableRow,
    TableHeader.extend({ content: "paragraph" }),
    TableCell.extend({ content: "paragraph" }),
  ];
}

/** Inserts a table of the chosen size over the slash query that asked for it. */
export function addTable(editor: Editor, range: Range, { rows, cols }: GridSize) {
  editor.chain().focus().deleteRange(range).insertTable({ rows, cols, withHeaderRow: true }).run();
}

/** Keeps a size inside the grid, so arrow keys cannot walk off the edge. */
export function clampSize({ rows, cols }: GridSize): GridSize {
  return {
    rows: Math.min(Math.max(rows, 1), GRID_MAX),
    cols: Math.min(Math.max(cols, 1), GRID_MAX),
  };
}

/**
 * How deep the table enclosing a position sits, or null when none does.
 *
 * `tableRole` is on the spec of all four table nodes and nothing else, so
 * climbing until the role reads "table" reaches the table itself from a cell, a
 * row, or a paragraph inside a cell.
 */
function tableDepth($pos: ResolvedPos) {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.spec.tableRole === "table") return depth;
  }
  return null;
}

/** True when a position sits anywhere inside a table. */
export function insideTable($pos: ResolvedPos) {
  return tableDepth($pos) !== null;
}

/**
 * Resolves a `<table>` element in the editor DOM back to its node in the document.
 *
 * The row and column handles are hover-driven, so what they have to go on is the
 * element under the pointer rather than a selection. `posAtDOM` lands at the
 * start of the table's content and the depth walk turns that into the position
 * the table itself begins at.
 *
 * An element the view does not know about throws out of `posAtDOM`, which is a
 * miss rather than a fault, so it comes back as null.
 */
export function tableAt(editor: Editor, dom: HTMLElement): TableTarget | null {
  try {
    const $pos = editor.state.doc.resolve(editor.view.posAtDOM(dom, 0));
    const depth = tableDepth($pos);
    if (depth === null) return null;

    const node = $pos.node(depth);
    const map = TableMap.get(node);

    return { node, pos: $pos.before(depth), rows: map.height, cols: map.width };
  } catch {
    return null;
  }
}

/** True when an index names a real slot in something `length` long. */
function within(index: number, length: number) {
  return Number.isInteger(index) && index >= 0 && index < length;
}

/**
 * A copy of `items` with the one at `from` lifted out and dropped at `to`.
 *
 * Both indices count places in the original array, which is what dnd-kit's
 * `arrayMove` means by them, so a drag can hand its two numbers straight over.
 */
function moved<T>(items: readonly T[], from: number, to: number) {
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * The table with row `from` lifted out and dropped at row `to`.
 *
 * Row 0 is the file's header row and takes no part: demote it and the next save
 * writes whichever row fell into its place as the header instead, restyling the
 * table without anybody having touched it. A refused move hands back the very
 * object it was given, which is how a caller tells "nothing happened" from "here
 * is a new table".
 *
 * @example reorderRows(table, 1, 3) // the first body row, now the third
 */
export function reorderRows(table: JSONContent, from: number, to: number): JSONContent {
  const rows = table.content ?? [];

  if (from === 0 || to === 0 || from === to) return table;
  if (!within(from, rows.length) || !within(to, rows.length)) return table;

  return { ...table, content: moved(rows, from, to) };
}

/**
 * The table with column `from` lifted out and dropped at column `to`, in every
 * row at once.
 *
 * Alignment lives on each cell rather than once on the table, so moving whole
 * cell objects carries a column's alignment along with it and there is nothing
 * further to patch. No column is protected: only rows have a header.
 */
export function reorderColumns(table: JSONContent, from: number, to: number): JSONContent {
  const rows = table.content ?? [];
  const cols = rows[0]?.content?.length ?? 0;

  if (from === to) return table;
  if (!within(from, cols) || !within(to, cols)) return table;

  return {
    ...table,
    content: rows.map((row) => ({ ...row, content: moved(row.content ?? [], from, to) })),
  };
}

/**
 * The table at a target's position as the document has it right now.
 *
 * A target is captured when the pointer enters a table and used when a button is
 * clicked, so the document can have moved on in between. Every command below
 * re-reads instead of trusting the snapshot, and gives up when whatever is there
 * is no longer a table.
 */
function currentTable(editor: Editor, target: TableTarget) {
  const node = editor.state.doc.nodeAt(target.pos);
  if (node?.type.spec.tableRole !== "table") return null;

  return { node, map: TableMap.get(node) };
}

/**
 * A command chain with the cell at (row, col) selected, or null when the table
 * has no such cell.
 *
 * prosemirror-tables reads the row and the column it works on off the selection,
 * so an index-addressed command has to aim the selection first. The click came
 * from a button outside the surface, and wherever the caret was left is not
 * where the caller is pointing. Handing back null is what turns an index outside
 * the table into a no-op.
 */
function atCell(editor: Editor, target: TableTarget, row: number, col: number) {
  const table = currentTable(editor, target);
  if (table === null) return null;

  const { map } = table;
  if (!within(row, map.height) || !within(col, map.width)) return null;

  const offset = map.map[row * map.width + col];
  if (offset === undefined) return null;

  const cell = target.pos + 1 + offset;

  return editor.chain().command(({ tr }) => {
    tr.setSelection(CellSelection.create(tr.doc, cell));
    return true;
  });
}

/**
 * Swaps the table for a rearranged copy of itself, in a single transaction.
 *
 * A move is expressed on the JSON rather than as a run of prosemirror-tables
 * calls, so cells travel whole with their attributes and the whole
 * rearrangement is one undo step. `rearrange` returning the object it was given
 * means the move was refused, and then nothing is dispatched at all.
 */
function rearrangeTable(editor: Editor, target: TableTarget, rearrange: (table: JSONContent) => JSONContent) {
  const table = currentTable(editor, target);
  if (table === null) return;

  const json: JSONContent = table.node.toJSON();
  const next = rearrange(json);
  if (next === json) return;

  const replacement = Node.fromJSON(editor.schema, next);

  editor
    .chain()
    .command(({ tr }) => {
      tr.replaceWith(target.pos, target.pos + table.node.nodeSize, replacement);
      return true;
    })
    .focus()
    .run();
}

/** Moves a row, both indices counted in the table as it stands. */
export function moveRow(editor: Editor, table: TableTarget, from: number, to: number) {
  rearrangeTable(editor, table, (json) => reorderRows(json, from, to));
}

/** Moves a column, and its alignment travels with it. */
export function moveColumn(editor: Editor, table: TableTarget, from: number, to: number) {
  rearrangeTable(editor, table, (json) => reorderColumns(json, from, to));
}

/**
 * Inserts an empty row so that it lands AT `index`, pushing the rest down.
 *
 * An `index` equal to the row count is an append, which is `addRowAfter` on the
 * last row; anything else is `addRowBefore` on the row sitting at that index
 * now. Index 0 does nothing, since a row above the header would become the
 * header on the next save.
 */
export function insertRow(editor: Editor, table: TableTarget, index: number) {
  const current = currentTable(editor, table);
  if (current === null || index < 1 || index > current.map.height) return;

  if (index === current.map.height) {
    atCell(editor, table, index - 1, 0)
      ?.addRowAfter()
      .focus()
      .run();
    return;
  }

  atCell(editor, table, index, 0)?.addRowBefore().focus().run();
}

/**
 * Inserts an empty column so that it lands AT `index`, pushing the rest right.
 *
 * Same shape as `insertRow`: an `index` equal to the column count appends, and
 * anything else goes in before the column standing there. There is no index to
 * refuse, because no column is the header.
 */
export function insertColumn(editor: Editor, table: TableTarget, index: number) {
  const current = currentTable(editor, table);
  if (current === null || index < 0 || index > current.map.width) return;

  if (index === current.map.width) {
    atCell(editor, table, 0, index - 1)
      ?.addColumnAfter()
      .focus()
      .run();
    return;
  }

  atCell(editor, table, 0, index)?.addColumnBefore().focus().run();
}

/** Deletes a row. Index 0 is the header row and does nothing. */
export function removeRow(editor: Editor, table: TableTarget, index: number) {
  if (index < 1) return;

  atCell(editor, table, index, 0)?.deleteRow().focus().run();
}

/**
 * Deletes a column, unless it is the last one the table has.
 *
 * prosemirror-tables refuses that one itself, and refuses it silently, so the
 * rule is written down here where the strip's missing minus button can be read
 * against it. Emptying a table is `removeTable`, a different button.
 */
export function removeColumn(editor: Editor, table: TableTarget, index: number) {
  const current = currentTable(editor, table);
  if (current === null || current.map.width < 2) return;

  atCell(editor, table, 0, index)?.deleteColumn().focus().run();
}

/** Deletes the whole table. */
export function removeTable(editor: Editor, table: TableTarget) {
  atCell(editor, table, 0, 0)?.deleteTable().focus().run();
}
