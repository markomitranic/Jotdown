"use client";

import { useRef, type ComponentProps } from "react";
import { cn } from "cn";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable } from "./useEditable";

/**
 * A grid of link cards of the article, editable where it stands.
 *
 * The core's `Cards` is this grid and nothing else, restated here class for
 * class so the element can be handed to the editor on the client, which
 * redraws the cards inside it as the same cards with their words editable.
 *
 * @example <EditableCards data-src-range="12:1-16:4">…</EditableCards>
 */
export function EditableCards({ className, ...props }: ComponentProps<"div"> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, props[SOURCE_RANGE]);

  return <div ref={root} className={cn("@container grid grid-cols-2 gap-3", className)} {...props} />;
}
