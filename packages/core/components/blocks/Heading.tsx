"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";
import { CopyCheckIcon, LinkIcon } from "lucide-react";
import { chromeButton } from "@jotdown/core/components/docs/button";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";

type HeadingProps = ComponentProps<"h1"> & { as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" };

/**
 * A heading that links to itself, with a button on hover that copies that link.
 *
 * A heading without an `id` is drawn plain. Adapted from Fumadocs UI, MIT.
 *
 * @example <Heading as="h2" id="install">Install</Heading>
 */
export function Heading({ as: As = "h1", className, children, ...props }: HeadingProps) {
  const [checked, copy] = useCopyButton(() => {
    if (!props.id) return;
    const url = new URL(window.location.href);
    url.hash = props.id;
    return navigator.clipboard.writeText(url.href);
  });

  if (!props.id)
    return (
      <As className={className} {...props}>
        {children}
      </As>
    );

  return (
    <As {...props} className={cn("group/heading flex scroll-m-28 flex-row items-center gap-1", className)}>
      <a data-card="" href={`#${props.id}`}>
        {children}
      </a>
      <button
        type="button"
        aria-live="polite"
        onClick={copy}
        className={chromeButton({
          variant: "ghost",
          size: "icon-xs",
          className:
            "not-prose shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100",
        })}
      >
        {checked ? <CopyCheckIcon /> : <LinkIcon />}
        <span className="sr-only">{checked ? "Copied anchor link" : "Copy anchor link"}</span>
      </button>
    </As>
  );
}
