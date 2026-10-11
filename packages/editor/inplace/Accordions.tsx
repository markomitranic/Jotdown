"use client";

import { useRef, type ComponentProps } from "react";
import { Accordions } from "@jotdown/core/components/blocks/Accordions";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable } from "./useEditable";

/**
 * Folded panels of the article, editable where they stand.
 *
 * `Accordions` is the bordered box around the panels, drawn as itself
 * and handed to the editor on the client, which redraws the panels inside it
 * closed, the way the build drew them, each with a header to open it.
 *
 * @example <EditableAccordions data-src-range="12:1-16:4">…</EditableAccordions>
 */
export function EditableAccordions(props: ComponentProps<typeof Accordions> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, props[SOURCE_RANGE]);

  return <Accordions ref={root} {...props} />;
}
