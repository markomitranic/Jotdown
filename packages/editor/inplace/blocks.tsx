"use client";

import { useRef, type ComponentProps, type ElementType } from "react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable } from "./useEditable";

/** Tags drawn as the block's children and nothing else, so the editor takes the whole element. */
type Whole = "p" | "ul" | "ol" | "blockquote";

/**
 * A block of the article, editable where the article drew it.
 *
 * On the server and through hydration this is the element the reader has always
 * had, stamped by the compiler with the lines it was written on. After mount,
 * the editor takes that same element over, so nothing moves, nothing is
 * swapped, and a click puts a caret where it looks like it should.
 *
 * A block nested inside something else, a paragraph in a callout or a list
 * inside a list item, has no stamp, because only top-level blocks carry one.
 * Those stay as they were drawn: the block around them is what is editable, as
 * one piece.
 *
 * @example export const Blockquote = editableBlock("blockquote");
 */
function editableBlock<T extends Whole>(tag: T) {
  function Editable({ children, ...props }: ComponentProps<T> & { [SOURCE_RANGE]?: string }) {
    const root = useRef<HTMLElement>(null);

    useEditable(root, props[SOURCE_RANGE]);

    const Tag = tag as ElementType;
    return (
      <Tag {...props} ref={root}>
        {children}
      </Tag>
    );
  }

  Editable.displayName = `Editable(${tag})`;
  return Editable;
}

export const Paragraph = editableBlock("p");
export const BulletList = editableBlock("ul");
export const OrderedList = editableBlock("ol");
export const Blockquote = editableBlock("blockquote");
