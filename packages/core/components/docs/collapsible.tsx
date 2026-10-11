"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "cn";
import { Collapsible } from "radix-ui";

/**
 * What a collapsible reveals, sliding open and shut, but never on the first paint.
 *
 * The animation classes arrive once the page is interactive, so a folder that
 * starts open does not play its opening on load. Adapted from Fumadocs UI, MIT.
 *
 * @example <CollapsibleContent>{rows}</CollapsibleContent>
 */
export function CollapsibleContent({ className, ...props }: ComponentProps<typeof Collapsible.Content>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Collapsible.Content
      {...props}
      className={cn(
        "overflow-hidden",
        mounted && "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className,
      )}
    />
  );
}
