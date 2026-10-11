"use client";

import { Search } from "lucide-react";
import { useSearchContext } from "@jotdown/core/components/docs/search";
import { useSidebar } from "@jotdown/core/components/docs/sidebar";
import { Button } from "@jotdown/core/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { SHORTCUTS, ShortcutHint } from "@jotdown/core/components/shortcuts";
import { SidebarToggle } from "@jotdown/core/components/SidebarToggle";

/**
 * The installed app's title bar: a see-through strip that drags the window.
 *
 * Drawn only while the browser lets the page paint beside the window's own
 * buttons. It comes first in the page, so every control drawn later over it
 * keeps its clicks, and it paints nothing, so the page scrolls on under it.
 *
 * @example <WindowTitleBar />
 */
export function WindowTitleBar() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-5 wco:block hidden h-(--titlebar-height) [-webkit-app-region:drag] [app-region:drag]"
    />
  );
}

/**
 * The buttons that sit in the title bar beside the traffic lights: the sidebar's toggle, and search while it is folded.
 *
 * They stay put whether the sidebar is open or folded, the way a native
 * sidebar's button does, so the sidebar's own header does without one.
 *
 * @example <DocsLayout><TitleBarControls />{page}</DocsLayout>
 */
export function TitleBarControls() {
  const { collapsed } = useSidebar();

  return (
    <div className="fixed top-0 left-[max(calc(var(--titlebar-start)+0.25rem),0.5rem)] z-30 hidden h-(--titlebar-height) items-center gap-0.5 md:wco:flex">
      <SidebarToggle />
      {collapsed && <SearchButton />}
    </div>
  );
}

function SearchButton() {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Search"
          className="text-muted-foreground"
          onClick={() => setOpenSearch(true)}
        >
          <Search />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ShortcutHint label="Search" chords={SHORTCUTS.search} />
      </TooltipContent>
    </Tooltip>
  );
}
