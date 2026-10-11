"use client";

import { createContext, use, useMemo, useRef, type ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import { searchPath } from "fumadocs-core/breadcrumb";
import { usePathname } from "fumadocs-core/framework";

/**
 * The page tree the layout draws, and the path through it to the page open now.
 *
 * The root is the innermost section folder on that path, so a page inside a
 * section with its own sidebar sees only that section's tree. Adapted from
 * Fumadocs UI, MIT.
 */

type Tree = { root: PageTree.Root | PageTree.Folder; full: PageTree.Root };

const TreeContext = createContext<Tree | null>(null);
const PathContext = createContext<PageTree.Node[]>([]);

/**
 * Holds the tree and works out the open page's path through it.
 *
 * @example <TreeProvider tree={tree}>{layout}</TreeProvider>
 */
export function TreeProvider({ tree: given, children }: { tree: PageTree.Root; children: ReactNode }) {
  const nextId = useRef(0);
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a tree is the same tree for as long as its $id is
  const tree = useMemo(() => given, [given.$id]);

  const path = useMemo(
    () =>
      searchPath(tree.children, pathname) ??
      (tree.fallback ? searchPath(tree.fallback.children, pathname) : null) ??
      [],
    [tree, pathname],
  );

  const root = path.findLast((node): node is PageTree.Folder => node.type === "folder" && Boolean(node.root)) ?? tree;
  root.$id ??= String(nextId.current++);

  return (
    <TreeContext value={useMemo(() => ({ root, full: tree }), [root, tree])}>
      <PathContext value={path}>{children}</PathContext>
    </TreeContext>
  );
}

/**
 * The tree being drawn: the open section's folder as `root`, and the whole tree as `full`.
 *
 * @example const { root } = useTreeContext();
 */
export function useTreeContext() {
  const tree = use(TreeContext);
  if (!tree) throw new Error("useTreeContext needs a DocsLayout above it.");
  return tree;
}

/**
 * The nodes from the top of the tree down to the open page.
 *
 * @example useTreePath().at(-1)?.name; // "Sections"
 */
export function useTreePath() {
  return use(PathContext);
}

/**
 * Whether a link's address is the page open now, a trailing slash either way.
 *
 * @example isActive("/guides/", "/guides"); // true
 * @example isActive("/guides", "/guides/sections", true); // true
 */
export function isActive(href: string, pathname: string, nested = false) {
  const link = normalize(href);
  const here = normalize(pathname);
  return link === here || (nested && here.startsWith(`${link}/`));
}

/**
 * An address without its trailing slash, except the root's own.
 *
 * @example normalize("/guides/"); // "/guides"
 */
export function normalize(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}
