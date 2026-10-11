"use client";

import { useRef, type ComponentProps } from "react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { WIDTH } from "@jotdown/core/lib/block-width";
import { useEditable } from "./useEditable";

/**
 * A markdown table of the article, editable where it stands.
 *
 * The core sits a table in a scrolling box, and the box is what the editor is
 * handed: the table inside it is redrawn as the same table with a caret in it.
 * The compiler stamps the `<table>`, and the stamp and a widened table's width
 * are moved up onto the box so the box is the block the page knows about.
 *
 * @example <EditableTable data-src-range="12:1-16:4">…</EditableTable>
 */
export function EditableTable({
  [SOURCE_RANGE]: stamp,
  [WIDTH]: width,
  ...props
}: ComponentProps<"table"> & { [SOURCE_RANGE]?: string; [WIDTH]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, stamp);

  return (
    <div
      ref={root}
      className="prose-no-margin relative my-6 overflow-auto"
      {...{ [SOURCE_RANGE]: stamp, [WIDTH]: width }}
    >
      <table {...props} />
    </div>
  );
}
