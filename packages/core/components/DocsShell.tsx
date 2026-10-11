"use client";

import type { ComponentProps, FC, ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import type { LayoutTab } from "@jotdown/core/components/docs/tabs";
import { DocsLayout } from "@jotdown/core/components/docs/layout";
import type { SidebarProps } from "@jotdown/core/components/docs/sidebar";
import { ThemeSwitch } from "@jotdown/core/components/ThemeSwitch";
import { ReadingSidebar, ShellBase } from "@jotdown/core/components/ReadingSidebar";
import { SidebarToggle } from "@jotdown/core/components/SidebarToggle";
import { SectionSwitcher } from "@jotdown/core/components/SectionSwitcher";

type DocsShellProps = {
  tree: PageTree.Root;
  tabs: LayoutTab[];
  title: ReactNode;
  base: string;
  /** The sidebar in place of the reading one, for an app that draws its tree differently. */
  sidebar?: FC<SidebarProps>;
  /** What the logo at the top of the sidebar opens, in place of a link home. */
  navTitle?: FC<ComponentProps<"a">>;
  /** The foot of the sidebar; the theme switch alone when unset. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The docs layout around a project's pages: the sidebar, its section tabs, the logo and the footer row.
 *
 * The section switcher is drawn as the sidebar's banner rather than handed to
 * the layout as tabs, so its menu is ours to size.
 *
 * Drawn in the browser so every component it hands the layout is made here. One
 * made on the server can reach the sidebar before its code has loaded, and
 * React then reports it as a list child without a key.
 *
 * @example <DocsShell tree={tree} tabs={tabs} title={logo} base="">{page}</DocsShell>
 */
export function DocsShell({
  tree,
  tabs,
  title,
  base,
  sidebar = ReadingSidebar,
  navTitle,
  footer = <SidebarFooter />,
  children,
}: DocsShellProps) {
  return (
    <ShellBase value={base}>
      <DocsLayout
        tree={tree}
        navTitle={navTitle}
        sidebar={sidebar}
        nav={{ title, url: base || "/", children: <SidebarToggle className="mb-auto wco:hidden" /> }}
        sidebarProps={{ footer, banner: <SectionSwitcher sections={tabs} /> }}
      >
        {children}
      </DocsLayout>
    </ShellBase>
  );
}

/**
 * The foot of the sidebar: the app's own tools on the left, if it has any, and the theme switch on the right.
 *
 * @example <SidebarFooter><ProjectTools /></SidebarFooter>
 */
export function SidebarFooter({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 text-muted-foreground">
      {children}
      <ThemeSwitch className="ms-auto" />
    </div>
  );
}
