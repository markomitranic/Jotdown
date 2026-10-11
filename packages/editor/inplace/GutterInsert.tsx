"use client";

/**
 * The quiet `+` that appears in the left margin of a block with nothing in it.
 *
 * Clicking it types a slash, so both ways into inserting a block end in the
 * same menu: one for a reader who knows the shortcut and one for a reader who
 * has just cleared a line and is looking for what to do next.
 *
 * The page-wide editor's own version asked its one document where the caret
 * was. There is no such document here, so this reads the page's selection
 * tracker, which is where every block's editor reports. What it asks is whether
 * the *line* the caret is on is empty, not whether the document is: a paragraph
 * of the article is a document of inline content and the two are the same
 * question, but a callout is a document of blocks, and a reader who has just
 * cleared a line inside one is owed the same offer as a reader who cleared one
 * beside it.
 *
 * It takes the grip's exact place and size in the margin and covers it, rather
 * than standing further out. The margin is the gap between the sidebar and the article, which
 * is about as wide as one control, so the second one put beside the first lands
 * under the sidebar: on screen in the DOM, invisible to the reader, and a click
 * there follows whichever sidebar link it landed on. Covering the grip costs
 * nothing, because the block underneath both of them is an empty line and
 * dragging an empty line moves nothing.
 */

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { Plus } from "lucide-react";
import { useTrackedSelection } from "./context";
import type { Editor } from "@tiptap/core";
import type { Selected } from "./selection";
import { firstLine, handleBounds, HANDLE_HEIGHT, HANDLE_WIDTH } from "./handleGeometry";

/** Where the caret is, but only while it is alone in an empty block. */
function useEmptyLine(): Selected | null {
  const where = useTrackedSelection();
  if (where === null || !where.empty) return null;

  const { $from } = where.editor.state.selection;
  const blank = $from.depth === 0 ? where.editor.state.doc.content.size === 0 : $from.parent.content.size === 0;

  return blank ? where : null;
}

/**
 * The element of the line the caret is on, which is what the button stands beside, as the grip does.
 *
 * A line inside a callout starts further in than the article does, and a button
 * out in the page margin beside it reads as belonging to the box rather than to
 * the line, which is the same thing that made the grip look broken there.
 */
function lineBox(editor: Editor, at: number): HTMLElement | null {
  const { node } = editor.view.domAtPos(at);
  return node instanceof HTMLElement ? node : node.parentElement;
}

/** @example <InplaceGutterInsert container={containerRef} /> */
export function InplaceGutterInsert({ container }: { container: RefObject<HTMLElement | null> }) {
  const line = useEmptyLine();
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const box = container.current;

    if (line === null || box === null) {
      setSpot(null);
      return;
    }

    const bounds = box.getBoundingClientRect();
    const ink = lineBox(line.editor, line.from);
    const grip =
      ink === null ? handleBounds(bounds) : handleBounds(ink.getBoundingClientRect(), firstLine(ink) ?? undefined);

    setSpot({ top: grip.top - bounds.top, left: grip.left - bounds.left });
  }, [line, container]);

  if (line === null || spot === null) return null;

  return (
    <button
      type="button"
      className="absolute z-50 grid pointer-coarse:hidden place-items-center rounded-md bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-primary max-lg:hidden"
      style={{ ...spot, width: HANDLE_WIDTH, height: HANDLE_HEIGHT }}
      aria-label="Insert a block"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => line.editor.chain().focus().insertContent("/").run()}
    >
      <Plus className="size-4" />
    </button>
  );
}
