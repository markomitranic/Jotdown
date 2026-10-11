import type { ReactNode } from "react";
import * as PageTree from "fumadocs-core/page-tree";
import { isActive, normalize } from "./tree";

/**
 * A section of the project as the section switcher lists it.
 *
 * Adapted from Fumadocs UI, MIT.
 */
export type LayoutTab = {
  title: ReactNode;
  url: string;
  icon?: ReactNode;
  description?: ReactNode;
  /** Listed only while the reader is inside it. */
  unlisted?: boolean;
  /** The section's folder, when the section is one of the tree's. */
  $folder?: PageTree.Folder;
  /** Every address that counts as inside the section, when it is not a folder. */
  urls?: Set<string>;
  props?: { className?: string };
};

/**
 * Whether the reader is inside a section: on one of its folder's pages, or under its address.
 *
 * @example isLayoutTabActive({ title: "Guides", url: "/guides" }, "/guides/install"); // true
 */
export function isLayoutTabActive(tab: LayoutTab, pathname: string) {
  if (tab.$folder)
    return (
      PageTree.findPath(tab.$folder.children, (node) => node.type === "page" && isActive(node.url, pathname)) !== null
    );
  if (tab.urls) return tab.urls.has(normalize(pathname));
  return isActive(tab.url, pathname, true);
}
