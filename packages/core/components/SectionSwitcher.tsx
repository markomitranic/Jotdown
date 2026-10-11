"use client";

import { useState } from "react";
import { cn } from "cn";
import Link from "fumadocs-core/link";
import { Popover } from "radix-ui";
import { isLayoutTabActive, type LayoutTab } from "@jotdown/core/components/docs/tabs";
import { useSidebar } from "@jotdown/core/components/docs/sidebar";
import { Check, ChevronsUpDown } from "lucide-react";
import { useOptimisticPathname } from "@jotdown/core/components/OptimisticPathname";

/**
 * The menu above the sidebar tree that moves a reader between the project's sections.
 *
 * The menu grows past the sidebar to fit its widest row, up to 22rem, and a
 * blurb longer than that wraps to two lines, so a long name never scrolls the
 * menu sideways. Picking a section keeps a phone's drawer open on its tree.
 *
 * @example <SectionSwitcher sections={sectionTabs(tree)} />
 */
export function SectionSwitcher({ sections }: { sections: LayoutTab[] }) {
  const [open, setOpen] = useState(false);
  const { closeOnRedirect } = useSidebar();
  const pathname = useOptimisticPathname();
  const current = sections.findLast((section) => isLayoutTabActive(section, pathname));

  if (!current) return null;

  const choose = () => {
    closeOnRedirect.current = false;
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex items-center gap-2 rounded-lg border bg-secondary/50 p-2 text-start text-secondary-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
        <div className="size-9 shrink-0 empty:hidden md:size-5">{current.icon}</div>

        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{current.title}</p>
          <p className="truncate text-muted-foreground text-sm empty:hidden md:hidden">{current.description}</p>
        </div>

        <ChevronsUpDown className="ms-auto size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          side="bottom"
          className="jd-scroll-container z-50 flex max-h-(--radix-popover-content-available-height) w-max min-w-(--radix-popover-trigger-width) max-w-[min(22rem,calc(100vw-2rem))] origin-(--radix-popover-content-transform-origin) flex-col gap-1 overflow-y-auto rounded-xl border bg-popover/60 p-1 text-popover-foreground text-sm shadow-lg backdrop-blur-lg focus-visible:outline-none data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in"
        >
          {sections.map((section) => {
            const active = section.url === current.url;
            if (section.unlisted && !active) return null;

            return (
              <Link
                key={section.url}
                href={section.url}
                onClick={choose}
                {...section.props}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent hover:text-accent-foreground",
                  section.props?.className,
                )}
              >
                <div className="size-9 shrink-0 empty:hidden md:mb-auto md:size-5">{section.icon}</div>

                <div className="min-w-0">
                  <p className="truncate font-medium text-sm leading-tight">{section.title}</p>
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground leading-snug empty:hidden">
                    {section.description}
                  </p>
                </div>

                <Check className={cn("ms-auto size-3.5 shrink-0 self-start text-primary", !active && "invisible")} />
              </Link>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
