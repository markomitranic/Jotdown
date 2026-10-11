"use client";

import { useRef, type ComponentProps } from "react";
import { cn } from "cn";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable } from "./useEditable";

/**
 * A file tree of the article, editable where it stands.
 *
 * The core's `Files` is this bordered card and nothing else, restated here class
 * for class so the element can be handed to the editor on the client, which
 * redraws the rows inside it as the same rows with their names editable.
 *
 * @example <EditableFiles data-src-range="12:1-16:4">…</EditableFiles>
 */
export function EditableFiles({ className, ...props }: ComponentProps<"div"> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, props[SOURCE_RANGE]);

  return <div ref={root} className={cn("not-prose rounded-md border bg-card p-2", className)} {...props} />;
}
