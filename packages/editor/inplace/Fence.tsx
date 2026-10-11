"use client";

import { useRef, type ComponentProps } from "react";
import { CodeBlock, Pre } from "@jotdown/core/components/blocks/CodeBlock";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable, type Within } from "./useEditable";

/**
 * The editor takes the scrolling viewport that holds the `<pre>`, not the frame.
 *
 * The frame carries the header, the copy button and the card, all of which stay
 * the reader's; the viewport is the one element whose children are exactly the
 * fence's own text.
 */
const VIEWPORT: Within = (figure) => {
  const viewport = figure.querySelector("pre")?.parentElement;
  return viewport ? { body: viewport } : null;
};

/**
 * A code fence of the article, editable where it stands.
 *
 * Rendered exactly as the core renders every `pre`, a `CodeBlock` holding a
 * `Pre`, and then handed to the editor on the client. It is the one component
 * a fence has: what the server draws is what the reader edits.
 *
 * @example <EditableFence data-src-range="12:1-16:4">…</EditableFence>
 */
export function EditableFence({ children, ...props }: ComponentProps<typeof CodeBlock> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLElement>(null);

  useEditable(root, props[SOURCE_RANGE], VIEWPORT);

  return (
    <CodeBlock ref={root} data-line-numbers {...props}>
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
