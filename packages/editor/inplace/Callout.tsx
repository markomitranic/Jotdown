"use client";

import { useRef, type ComponentProps } from "react";
import { CalloutContainer } from "@jotdown/core/components/blocks/Callout";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable, type Within } from "./useEditable";

/**
 * A callout is two editable things, and the stamped box is neither of them.
 *
 * The box holds a colour rail, an icon and a content column, so handing it to
 * an editor would wipe the lot. The body is the column's prose, which is the
 * directive's content, and the label is a plain string attribute on the
 * directive, `:::tip[Read this first]`, which is why it gets an editor of its
 * own rather than being part of the same document.
 *
 * A callout with no label still has a label element, because the keyword's own
 * name is drawn in its place. Typing in that is how a reader adds one.
 */
const PARTS: Within = (root) => {
  const body = root.querySelector<HTMLElement>("[data-callout-body]");
  if (body === null) return null;

  return { body, title: root.querySelector<HTMLElement>("[data-callout-title]") };
};

/**
 * The callout of the article, with its body and its label editable in place.
 *
 * Registered as `CalloutContainer`, which is the tag `remarkDirectiveAdmonition`
 * rewrites every `:::note` into, so this is what the whole directive family
 * renders through.
 */
export function EditableCallout(props: ComponentProps<typeof CalloutContainer> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, props[SOURCE_RANGE], PARTS);

  return <CalloutContainer {...props} ref={root} />;
}
