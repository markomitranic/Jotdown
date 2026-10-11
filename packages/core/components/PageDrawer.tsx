"use client";

import { useRef, useState, type ReactNode } from "react";
import { PanelRight, X } from "lucide-react";
import { SHORTCUTS, ShortcutHint, useShortcut } from "@jotdown/core/components/shortcuts";
import { Button } from "@jotdown/core/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@jotdown/core/components/ui/sheet";
import { Tabs } from "@jotdown/core/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";

/**
 * Whether the page drawer is open and on which tab, for the drawer and whatever opens it.
 *
 * The shortcut toggles the drawer where it was left; `show` opens it on a
 * named tab, which is how the Share button lands on the share tab.
 *
 * @example const drawer = usePageDrawer<"settings" | "share">("settings"); drawer.show("share");
 */
export function usePageDrawer<Tab extends string>(first: Tab) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(first);
  useShortcut(SHORTCUTS.drawer, () => setOpen((shown) => !shown));

  function show(chosen: Tab) {
    setTab(chosen);
    setOpen(true);
  }

  return { open, setOpen, tab, setTab, show };
}

export type Drawer<Tab extends string> = ReturnType<typeof usePageDrawer<Tab>>;

/**
 * The panel icon in the page's corner, and the drawer of tabs it opens beside the content.
 *
 * The drawer holds what is about the page rather than in it; each app hands
 * in the tabs it has, a `TabsList` and a `TabsContent` for each. It covers
 * the page with a curtain, and a click on the curtain closes it. Closed by
 * the keyboard, focus goes back to the panel icon; closed by a click, it
 * stays where the reader is, so the icon's tooltip does not pop up.
 *
 * @example <PageDrawer drawer={drawer} title="Setup"><TabsList>…</TabsList><TabsContent value="share">…</TabsContent></PageDrawer>
 */
export function PageDrawer<Tab extends string>({
  drawer,
  title,
  children,
}: {
  drawer: Drawer<Tab>;
  title: string;
  children: ReactNode;
}) {
  const clicked = useRef(false);

  return (
    <Sheet open={drawer.open} onOpenChange={drawer.setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Page panel">
              <PanelRight className="text-muted-foreground" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <ShortcutHint label="Page panel" chords={SHORTCUTS.drawer} />
        </TooltipContent>
      </Tooltip>

      <SheetContent
        aria-describedby={undefined}
        onPointerDownCapture={() => (clicked.current = true)}
        onPointerDownOutside={() => (clicked.current = true)}
        onKeyDownCapture={() => (clicked.current = false)}
        onCloseAutoFocus={(event) => clicked.current && event.preventDefault()}
      >
        <header className="flex shrink-0 items-center gap-2 ps-4 pe-2 pt-3">
          <SheetTitle className="min-w-0 flex-1 truncate">{title}</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </SheetClose>
        </header>

        <Tabs value={drawer.tab} onValueChange={(tab) => drawer.setTab(tab as Tab)} className="min-h-0 flex-1">
          {children}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
