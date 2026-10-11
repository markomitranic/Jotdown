"use client";

import { Children, type ElementType, type ReactNode } from "react";
import { cn } from "cn";
import { useEditing } from "./context";

type Props = {
  children?: ReactNode;
  as?: ElementType;
  className?: string;
  /** What an empty slot says in the canvas, where it can be typed into. */
  placeholder?: string;
};

/**
 * Where a block draws what was written between its tags, prose the canvas edits like any other.
 *
 * The prose itself is the page's: each paragraph, list and heading inside is
 * edited in place by the canvas as it would be anywhere else on the page. A
 * block written with nothing inside offers a first line to type, which is
 * written between its tags.
 *
 * @example <Slot className="mt-6 text-lg" />
 */
export function Slot({ children, as: Tag = "div", className, placeholder = "Write here" }: Props) {
  const editing = useEditing();
  if (Children.count(children) > 0 || !editing) return <Tag className={className}>{children}</Tag>;

  return (
    <Tag className={className}>
      {/* biome-ignore lint/a11y/useSemanticElements: an editable line is the text box, since an input cannot hold prose */}
      <div
        tabIndex={0}
        className={cn(
          "cursor-text rounded-sm outline-offset-4 hover:outline-dashed hover:outline-1 hover:outline-primary/40 focus:outline-2 focus:outline-primary/60 focus:outline-solid",
          "empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)]",
        )}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label="Content"
        data-placeholder={placeholder}
        onKeyDown={(event) => {
          if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
        }}
        onBlur={(event) => {
          const typed = (event.currentTarget.textContent ?? "").trim();
          if (typed) editing.editor.fill(editing.stamp, typed);
        }}
      />
    </Tag>
  );
}
