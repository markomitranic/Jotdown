"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import type * as PageTree from "fumadocs-core/page-tree";
import { Sidebar, SidebarItem, type SidebarProps } from "@jotdown/core/components/docs/sidebar";
import { sectionAccent } from "@jotdown/core/lib/sections";
import { useSidebarShortcut } from "@jotdown/core/components/SidebarToggle";
import { useOptimisticPathname } from "@jotdown/core/components/OptimisticPathname";

/**
 * How a group's label is set, in the reading sidebar and in any sidebar drawn in its place.
 *
 * The code face in caps, one step heavier than the rows under it and on wide
 * tracking, which reads as a quiet technical tag rather than a heading. It needs
 * the variable mono to render: the static cut had no 500, so this used to
 * resolve down to 400 and the label carried the same weight as the page titles
 * beneath it.
 */
export const GROUP_LABEL = "font-mono text-1sm font-medium uppercase tracking-wider";

/** Where the open project's pages are served, for the sidebar to tell which section the reader is in. */
export const ShellBase = createContext("");

/**
 * The sidebar a reader sees: the project's page tree, painted in the colour of the section they are in.
 *
 * Wired in as the layout's sidebar slot, so the aside itself is the layout's
 * own: the search box, the drawer on a phone and the footer all keep working.
 * The accent variable is the one the whole tree paints from, and it is set
 * here because this is the only component above the aside that knows the
 * current URL.
 *
 * Being drawn once, it is also where the sidebar's own shortcut is answered.
 *
 * @example <DocsLayout slots={{ sidebar: { root: ReadingSidebar, … } }} />
 */
export function ReadingSidebar({ components, style, ...props }: SidebarProps) {
  useSidebarShortcut();
  const accent = {
    ...style,
    "--color-primary": sectionAccent(useOptimisticPathname(), useContext(ShellBase)),
  } as CSSProperties;

  return (
    <Sidebar {...props} style={accent} components={{ Separator: SidebarSection, Item: SidebarPage, ...components }} />
  );
}

/**
 * A page in the tree, with room at the end of the row for a mark of the app's own.
 *
 * @example <SidebarPage item={item} mark={<Dot />} />
 */
export function SidebarPage({ item, mark }: { item: PageTree.Item; mark?: ReactNode }) {
  const pathname = useOptimisticPathname();

  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      active={trimmed(item.url) === trimmed(pathname)}
      icon={item.icon}
    >
      {item.name}
      {mark}
    </SidebarItem>
  );
}

/** One URL as the other spells it, since only one of the two ever carries a trailing slash. */
function trimmed(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Separates page groups with a compact typographic label. */
function SidebarSection({ item }: { item: PageTree.Separator }) {
  return (
    <p className={cn("mt-6 mb-1.5 flex items-center gap-1.5 px-2 text-muted-foreground first:mt-0", GROUP_LABEL)}>
      {item.icon}
      {item.name}
    </p>
  );
}
