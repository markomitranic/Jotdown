import type { ComponentType, ReactNode } from "react";
import type { KitPage, KitSite } from "./context";
import type { BlockMeta } from "./define";

/**
 * What a layout is handed: the page, its site, and the page's own content to place.
 *
 * @example export default function Landing({ page, children }: LayoutProps) { return <main>{children}</main>; }
 */
export type LayoutProps = { page: KitPage; site: KitSite; children: ReactNode };

/**
 * Every block the framework offers in the editor, by the name a layout lists it with.
 *
 * Headings of every level are one `heading`, and every kind of callout one
 * `callout`. The docs layout offers all of them, and a layout of a project's own
 * spreads them into its list to do the same.
 *
 * @example export default defineLayout(Post, { blocks: [...frameworkBlocks, PostMeta] });
 */
export const frameworkBlocks = [
  "text",
  "heading",
  "bulletList",
  "numberedList",
  "todoList",
  "quote",
  "code",
  "diagram",
  "whiteboard",
  "image",
  "video",
  "linkEmbed",
  "file",
  "table",
  "divider",
  "callout",
  "source",
  "accordion",
  "steps",
  "tabs",
  "cards",
  "fileTree",
] as const;

export type FrameworkBlock = (typeof frameworkBlocks)[number];

/** One entry of a layout's list: a framework block by name, or a project block registered with `defineBlock`. */
export type LayoutBlock = FrameworkBlock | { block: BlockMeta };

/**
 * Gives a layout the list of blocks its pages may insert, and hands the same component back.
 *
 * The list is all the editor offers on those pages, in `/` and in Turn into,
 * framework blocks included, so an empty list offers nothing. Blocks already on
 * a page draw and edit whether they are listed or not.
 *
 * @example export default defineLayout(Profile, { blocks: ["text", "heading", Role] });
 */
export function defineLayout(layout: ComponentType<LayoutProps>, { blocks }: { blocks: readonly LayoutBlock[] }) {
  return Object.assign(layout, { blocks });
}

/** A layout as `.jotdown/layouts` exports it, with the blocks its pages may insert. */
export type ProjectLayout = ReturnType<typeof defineLayout>;
