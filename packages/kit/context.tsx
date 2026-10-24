"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * What a project's own blocks know about where they are drawn, and how they ask to change.
 *
 * A published page provides the page, the site and its pages, and nothing to
 * edit with, so every primitive draws plain markup. The editing canvas
 * provides the same three, says it is the studio, and hands over an editor,
 * and a block drawn there is told where it was written, so its primitives can
 * write back into the file.
 */

/** The page being drawn: its front matter, and the address a reader opens it at. */
export type KitPage = {
  title: string;
  description?: string;
  url: string;
  /** Every front matter field the framework knows, `layout` and `icon` among them. */
  data: Record<string, unknown>;
};

/** The site the page belongs to. */
export type KitSite = {
  title: string;
  description?: string;
  /** The path every page address starts with, empty for a site at a domain's root. */
  base: string;
  /** Where the site is published, when the config names it. */
  url?: string;
};

/** One page of the site as a list of pages shows it. */
export type KitPageSummary = { title: string; description?: string; url: string };

/** How a block drawn in the editing canvas changes the file it was written in. */
export type KitEditor = {
  /** Writes one prop of the block written at `stamp`, as a string literal. */
  setProp(stamp: string, prop: string, value: string): void;
  /** Gives a block written with nothing inside it its first paragraph. */
  fill(stamp: string, text: string): void;
  /** Commits a picture and answers with its address, or with why it could not. */
  upload(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

type Kit = { page: KitPage; site: KitSite; pages: KitPageSummary[]; inStudio: boolean };

const KitContext = createContext<Kit | null>(null);

/** The canvas's editor, which a published page has none of. */
const EditorContext = createContext<KitEditor | null>(null);

/** Where the block being drawn was written, which only the editing canvas knows. */
const BlockContext = createContext<string | null>(null);

/**
 * Hands the page, the site and its pages to every project block and layout below it, and whether this is the studio.
 *
 * @example <KitProvider page={page} site={site} pages={pages} inStudio><MDX /></KitProvider>
 */
export function KitProvider({
  page,
  site,
  pages,
  inStudio = false,
  children,
}: Omit<Kit, "inStudio"> & { inStudio?: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ page, site, pages, inStudio }), [page, site, pages, inStudio]);

  return <KitContext value={value}>{children}</KitContext>;
}

/**
 * Hands the canvas's editor to every project block below it.
 *
 * @example <KitEditorScope editor={editor}><Article /></KitEditorScope>
 */
export function KitEditorScope({ editor, children }: { editor: KitEditor | null; children: ReactNode }) {
  return <EditorContext value={editor}>{children}</EditorContext>;
}

/**
 * Tells the primitives inside one block where in the file that block was written.
 *
 * @example <BlockScope stamp="12:1-16:9"><Hero {...props} /></BlockScope>
 */
export function BlockScope({ stamp, children }: { stamp: string | null; children: ReactNode }) {
  return <BlockContext value={stamp}>{children}</BlockContext>;
}

function useKit(): Kit {
  const kit = useContext(KitContext);
  if (kit === null) throw new Error("A project block was drawn outside a Jotdown page.");
  return kit;
}

/**
 * The editor and the block's place in the file, when this block can be edited where it stands.
 *
 * @example const editing = useEditing(); if (editing) editing.editor.setProp(editing.stamp, "title", "Hi");
 */
export function useEditing() {
  const editor = useContext(EditorContext);
  const stamp = useContext(BlockContext);
  return editor && stamp ? { editor, stamp } : null;
}

/**
 * Whether the block is drawn in the editing canvas, where its primitives take a caret.
 *
 * @example const editable = useIsEditable(); // false on the published site
 */
export function useIsEditable() {
  return useEditing() !== null;
}

/**
 * Whether the page is drawn inside the Jotdown studio, rather than for a reader of the published site.
 *
 * Any block or layout can ask, so it can leave out what only a reader wants,
 * such as analytics, a cookie banner or an autoplaying video, while you edit.
 * It is true on every page the studio draws, including one that cannot be
 * edited, where `useIsEditable()` is false.
 *
 * @example const inStudio = useInStudio(); // false on the published site
 */
export function useInStudio() {
  return useKit().inStudio;
}

/**
 * The page being drawn.
 *
 * @example const { title, data } = usePage();
 */
export function usePage() {
  return useKit().page;
}

/**
 * The site the page belongs to.
 *
 * @example const { title, base } = useSite();
 */
export function useSite() {
  return useKit().site;
}

type PagesQuery = {
  /** Only the pages under this folder, as a path from the site's root, `"guides"` or `"guides/setup"`. */
  folder?: string;
  /** The sidebar's own order, or by title. */
  sort?: "order" | "title";
  limit?: number;
};

/**
 * The site's pages, as the sidebar orders them, narrowed to a folder.
 *
 * @example usePages({ folder: "guides", limit: 3 }); // [{ title: "Setup", url: "/guides/setup" }, …]
 */
export function usePages({ folder, sort = "order", limit }: PagesQuery = {}) {
  const { pages, site } = useKit();

  return useMemo(() => {
    const under = folder ? `${site.base}/${folder.replace(/^\/|\/$/g, "")}/` : null;
    const found = under ? pages.filter((page) => page.url.startsWith(under)) : pages;
    const sorted = sort === "title" ? found.toSorted((a, b) => a.title.localeCompare(b.title)) : found;
    return limit === undefined ? sorted : sorted.slice(0, limit);
  }, [pages, site.base, folder, sort, limit]);
}
