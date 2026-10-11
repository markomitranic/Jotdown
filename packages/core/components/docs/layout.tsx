"use client";

import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties, type FC, type ReactNode } from "react";
import { SidebarIcon } from "lucide-react";
import Link from "fumadocs-core/link";
import type * as PageTree from "fumadocs-core/page-tree";
import { chromeButton } from "./button";
import { LayoutContext, useDocsLayout } from "./context";
import { SearchTrigger } from "./search";
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar, type SidebarProps } from "./sidebar";
import { TreeProvider } from "./tree";

/**
 * The docs layout: a grid of the sidebar, the page and its table of contents, with a header bar on a phone.
 *
 * The grid's columns are driven by `--jd-*` variables that each part sets for
 * itself once it is drawn, so a page without a table of contents gives its
 * column back. Adapted from Fumadocs UI, MIT.
 */

type DocsLayoutProps = {
  tree: PageTree.Root;
  /** The logo at the top of the sidebar and the phone header, the link home, and what sits beside it. */
  nav: { title: ReactNode; url: string; children?: ReactNode };
  /** What the logo is, in place of a link home. */
  navTitle?: FC<ComponentProps<"a">>;
  /** The sidebar in place of the default one. */
  sidebar?: FC<SidebarProps>;
  /** The sidebar's banner and footer. */
  sidebarProps?: SidebarProps;
  children: ReactNode;
};

/**
 * Lays out a project's pages around its tree.
 *
 * @example <DocsLayout tree={tree} nav={{ title: logo, url: "/" }}>{page}</DocsLayout>
 */
export function DocsLayout({
  tree,
  nav,
  navTitle,
  sidebar: SidebarSlot = Sidebar,
  sidebarProps,
  children,
}: DocsLayoutProps) {
  const layout = useMemo(
    () => ({ navTitle: navTitle ?? NavLink, nav: { title: nav.title, url: nav.url }, navChildren: nav.children }),
    [nav.url, nav.title, nav.children, navTitle],
  );

  return (
    <TreeProvider tree={tree}>
      <LayoutContext value={layout}>
        <SidebarProvider>
          <Container>
            <Header />
            <SidebarSlot {...sidebarProps} />
            {children}
          </Container>
        </SidebarProvider>
      </LayoutContext>
    </TreeProvider>
  );
}

/**
 * The logo as a link home, the default when the app names no logo of its own.
 *
 * One component for the life of the page, so the logo's images stay put while
 * the layout around them redraws.
 *
 * @example <NavLink className="inline-flex" />
 */
function NavLink(props: ComponentProps<"a">) {
  const { nav } = useDocsLayout();

  return (
    <Link href={nav.url} {...props}>
      {nav.title}
    </Link>
  );
}

/** The grid, which animates its sidebar column only when the sidebar folds or unfolds. */
function Container({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const [previous, setPrevious] = useState(collapsed);
  const changed = previous !== collapsed;

  useEffect(() => {
    if (changed) setPrevious(collapsed);
  }, [collapsed, changed]);

  return (
    <div
      id="jd-docs-layout"
      data-sidebar-collapsed={collapsed}
      data-column-changed={changed}
      style={
        {
          gridTemplate: `"sidebar sidebar header toc toc"
"sidebar sidebar toc-popover toc toc"
"sidebar sidebar main toc toc" 1fr / minmax(min-content, 1fr) var(--jd-sidebar-col) minmax(0, calc(var(--jd-layout-width,97rem) - var(--jd-sidebar-width) - var(--jd-toc-width))) var(--jd-toc-width) minmax(min-content, 1fr)`,
          "--jd-docs-row-1": "var(--jd-banner-height, 0px)",
          "--jd-docs-row-2": "calc(var(--jd-docs-row-1) + var(--jd-header-height))",
          "--jd-docs-row-3": "calc(var(--jd-docs-row-2) + var(--jd-toc-popover-height))",
          "--jd-sidebar-col": collapsed ? "0px" : "var(--jd-sidebar-width)",
        } as CSSProperties
      }
      className="grid min-h-(--jd-docs-height) overflow-x-clip [--jd-docs-height:100dvh] [--jd-header-height:0px] [--jd-sidebar-width:0px] [--jd-toc-popover-height:0px] [--jd-toc-width:0px] data-[column-changed=true]:transition-[grid-template-columns]"
    >
      {children}
    </div>
  );
}

/** The phone's header bar: the logo, the extras beside it, search and the drawer's button. */
function Header() {
  return (
    <header
      id="jd-subnav"
      data-transparent={false}
      className="sticky top-(--jd-docs-row-1) z-30 flex h-(--jd-header-height) items-center border-b bg-background/80 ps-4 pe-2.5 backdrop-blur-sm transition-colors [grid-area:header] md:hidden max-md:layout:[--jd-header-height:--spacing(14)]"
    >
      <HeaderTitle />
      <div className="flex-1">
        <HeaderExtras />
      </div>
      <SearchTrigger className="p-2" />
      <SidebarTrigger className={chromeButton({ variant: "ghost", size: "icon-sm", className: "p-2" })}>
        <SidebarIcon />
      </SidebarTrigger>
    </header>
  );
}

function HeaderTitle() {
  const { navTitle: Title } = useDocsLayout();
  return <Title className="inline-flex items-center gap-2.5 font-semibold" />;
}

function HeaderExtras() {
  return useDocsLayout().navChildren;
}
