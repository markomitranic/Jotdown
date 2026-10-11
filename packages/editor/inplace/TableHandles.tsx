"use client";

import { useCallback, type RefObject } from "react";
import TableHandles from "../editor/TableHandles";
import { useInplace } from "./context";
import { blockAt } from "./handles";

/**
 * A table's own row and column controls, bound to whichever editor holds it.
 *
 * The controls themselves are the page-wide editor's, unchanged: a grip per
 * row and column to drag it, a `+` at every boundary, a `−` over the one being
 * pointed at, and a `×` to take the whole table away. All that differs here is
 * the question of whose table it is, which used to have one answer and now has
 * one per block.
 *
 * A table the article drew has no editor, so it gets no controls. Its cells
 * are markup the build wrote, and giving them handles would mean redrawing the
 * table from the schema and losing the frame the core put around it.
 *
 * Deleting is the one command that means something different here. A table
 * inserted in place is a block whose whole document is that table, so taking
 * the node out would empty the editor and leave a blank slot standing where
 * the table was. The block itself is what goes, through the same grip the rest
 * of the page uses, so one undo brings it back.
 *
 * @example <InplaceTableHandles container={containerRef} />
 */
export function InplaceTableHandles({ container }: { container: RefObject<HTMLElement | null> }) {
  const page = useInplace();
  const editors = page?.editors;
  const handles = page?.handles;

  const editorFor = useCallback((table: HTMLTableElement) => editors?.owning(table) ?? null, [editors]);

  const onDelete = useCallback(
    (table: HTMLTableElement) => {
      const root = container.current;
      if (handles === undefined || root === null) return;
      blockAt(handles, root, table)?.remove();
    },
    [handles, container],
  );

  if (!page) return null;

  return <TableHandles editorFor={editorFor} onDelete={onDelete} containerRef={container} />;
}
