"use client";

import { PanelLeft } from "lucide-react";
import { cn } from "cn";
import { useSidebar } from "@jotdown/core/components/docs/sidebar";
import { Button } from "@jotdown/core/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { SHORTCUTS, ShortcutHint, useShortcut } from "./shortcuts";

/**
 * The button in the sidebar's header that folds the sidebar away, with its shortcut on hover.
 *
 * The layout draws its header's extras twice, once in the sidebar and once in
 * the phone header, so the shortcut is not here: `useSidebarShortcut` answers
 * it, from the sidebar, which is drawn once.
 *
 * @example <DocsLayout nav={{ children: <SidebarToggle className="mb-auto wco:hidden" /> }} />
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
          className={cn("text-muted-foreground max-md:hidden", className)}
          onClick={() => setCollapsed((folded) => !folded)}
        >
          <PanelLeft />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint label="Toggle sidebar" chords={SHORTCUTS.sidebar} />
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Folds the sidebar on its shortcut on a desktop, and opens the drawer on a phone, where the sidebar is a drawer.
 *
 * @example useSidebarShortcut();
 */
export function useSidebarShortcut() {
  const { setCollapsed, setOpen } = useSidebar();

  useShortcut(SHORTCUTS.sidebar, () => {
    if (window.matchMedia("(width < 48rem)").matches) setOpen((open) => !open);
    else setCollapsed((folded) => !folded);
  });
}
