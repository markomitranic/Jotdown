"use client";

import { useRef, type ComponentProps } from "react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useEditable } from "./useEditable";

/**
 * A numbered procedure of the article, editable where it stands.
 *
 * The core's `Steps` is `<div className="jd-steps">` and drops every other
 * prop, the compiler's source stamp included. This is that one element with
 * the stamp kept on it, handed to the editor on the client.
 *
 * @example <EditableSteps data-src-range="12:1-16:4">…</EditableSteps>
 */
export function EditableSteps(props: ComponentProps<"div"> & { [SOURCE_RANGE]?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEditable(root, props[SOURCE_RANGE]);

  return <div ref={root} {...props} className="jd-steps" />;
}
