"use client";

import { Fragment, useMemo, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "fumadocs-core/link";
import type * as PageTree from "fumadocs-core/page-tree";
import { getBreadcrumbItemsFromPath } from "fumadocs-core/breadcrumb";
import { usePathname } from "fumadocs-core/framework";
import type { TableOfContents } from "fumadocs-core/toc";
import { TOC, TOCPopover, TOCProvider } from "./toc";
import { isActive, useTreeContext, useTreePath } from "./tree";

/**
 * One page in the docs layout: its table of contents, the breadcrumb above it and the next and previous pages below it.
 *
 * Adapted from Fumadocs UI, MIT.
 */

type DocsPageProps = {
  toc?: TableOfContents;
  /** A page wider than the reading measure, with no table of contents. */
  full?: boolean;
  breadcrumb?: boolean;
  footer?: boolean;
  tableOfContent?: boolean;
  children: ReactNode;
};

/**
 * The page's column in the layout, and the table of contents beside or above it.
 *
 * @example <DocsPage toc={compiled.toc}><DocsTitle>Install</DocsTitle><DocsBody>…</DocsBody></DocsPage>
 */
export function DocsPage({
  toc = [],
  full = false,
  breadcrumb = true,
  footer = true,
  tableOfContent = !full,
  children,
}: DocsPageProps) {
  const listed = tableOfContent ? toc : [];

  return (
    <TOCProvider toc={listed}>
      {listed.length > 0 && <TOCPopover />}
      <main className="grid justify-items-center [grid-area:main]" data-layout-main="">
        <article
          id="jd-page"
          data-layout-content=""
          data-full={full}
          className={cn(
            "flex w-full min-w-0 max-w-[900px] flex-col gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14",
            "md:in-data-[sidebar-collapsed=true]:pt-16 xl:in-data-[sidebar-collapsed=true]:pt-14",
            full && "max-w-[1168px]",
          )}
        >
          {breadcrumb && <PageBreadcrumb />}
          {children}
          {footer && <PageFooter />}
        </article>
      </main>
      {tableOfContent && <TOC />}
    </TOCProvider>
  );
}

/**
 * The article's prose, set in the typography every page shares.
 *
 * @example <DocsBody>{content}</DocsBody>
 */
export function DocsBody({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("prose flex-1", className)} />;
}

/**
 * The page's title.
 *
 * @example <DocsTitle>Install</DocsTitle>
 */
export function DocsTitle({ className, ...props }: ComponentProps<"h1">) {
  return <h1 {...props} className={cn("font-semibold text-[1.75em]", className)} />;
}

/**
 * The line under the title, or nothing when the page has none.
 *
 * @example <DocsDescription>What you need before you start.</DocsDescription>
 */
export function DocsDescription({ className, children, ...props }: ComponentProps<"p">) {
  if (children === undefined) return null;
  return (
    <p {...props} className={cn("mb-8 text-lg text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** The folders above the open page, each a link when it has a page of its own. */
function PageBreadcrumb() {
  const path = useTreePath();
  const { root } = useTreeContext();
  const items = useMemo(() => getBreadcrumbItemsFromPath(root, path, {}), [path, root]);
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
      {items.map((item, index) => {
        const className = cn("truncate", index === items.length - 1 && "font-medium text-primary");
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a breadcrumb is redrawn whole on every page
          <Fragment key={index}>
            {index !== 0 && <ChevronRight className="size-3.5 shrink-0" />}
            {item.url ? (
              <Link href={item.url} className={cn(className, "transition-opacity hover:opacity-80")}>
                {item.name}
              </Link>
            ) : (
              <span className={className}>{item.name}</span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

const pageLists = new WeakMap<PageTree.Root | PageTree.Folder, PageTree.Item[]>();

/**
 * Every page of the open section in reading order, folders' own pages first, kept per tree.
 *
 * @example readingOrder(root).map((page) => page.url); // ["/", "/install", …]
 */
function readingOrder(root: PageTree.Root | PageTree.Folder) {
  const known = pageLists.get(root);
  if (known) return known;

  const pages: PageTree.Item[] = [];
  const visit = (node: PageTree.Node) => {
    if (node.type === "folder") {
      if (node.index) visit(node.index);
      node.children.forEach(visit);
    } else if (node.type === "page" && !node.external) pages.push(node);
  };
  root.children.forEach(visit);

  pageLists.set(root, pages);
  return pages;
}

/** The previous and next pages in reading order, as two cards under the article. */
function PageFooter() {
  const { root } = useTreeContext();
  const pathname = usePathname();
  const pages = readingOrder(root);
  const at = pages.findIndex((page) => isActive(page.url, pathname));
  if (at === -1) return null;

  const previous = pages[at - 1];
  const next = pages[at + 1];

  return (
    <div className={cn("@container grid gap-4", previous && next ? "grid-cols-2" : "grid-cols-1")}>
      {previous && <FooterCard page={previous} next={false} />}
      {next && <FooterCard page={next} next />}
    </div>
  );
}

function FooterCard({ page, next }: { page: PageTree.Item; next: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;

  return (
    <Link
      href={page.url}
      className={cn(
        "@max-lg:col-span-full flex flex-col gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent/80 hover:text-accent-foreground",
        next && "text-end",
      )}
    >
      <div className={cn("inline-flex items-center gap-1.5 font-medium", next && "flex-row-reverse")}>
        <Icon className="-mx-1 size-4 shrink-0 rtl:rotate-180" />
        <p>{page.name}</p>
      </div>
      <p className="text-muted-foreground">{page.description ?? (next ? "Next Page" : "Previous Page")}</p>
    </Link>
  );
}
