import { findPath, type Node, type Root } from "fumadocs-core/page-tree";
import { SectionCards } from "./SectionCards";

/**
 * The grid of child pages every section landing page ends with.
 *
 * Available in any page as `<DocCardList />` with no import. It lists the
 * siblings of the current page, or the top-level sections when the page is the
 * site root, and writes its own heading. Each card carries the target's
 * `description`, from front matter for a page and from `meta.json` for a section.
 *
 * The route binds it to the project's page tree and the page it sits on.
 *
 * @example <DocCardList tree={tree} url="/manual" root={false} title="Read next" />
 */
export function DocCardList({ tree, url, root, title }: { tree: Root; url: string; root: boolean; title?: string }) {
  const peers = siblingsOf(tree, url, root).filter((node) => hrefOf(node) !== url);
  if (peers.length === 0) return null;

  const heading = title ?? (root ? "Sections" : "In this section");
  const cards = peers.map((node) => ({ href: hrefOf(node), title: String(node.name), description: node.description }));

  return <SectionCards heading={heading} cards={cards} />;
}

/**
 * The folder a page sits in, walked from the root of the tree.
 *
 * The site root also counts the sections held out of the tree, because a
 * section with its own sidebar is excluded from its parent's `pages` and would
 * otherwise be missing from the one grid whose job is to name every section.
 */
function siblingsOf(tree: Root, url: string, root: boolean) {
  const trail =
    findPath(tree.children, (node) => node.type === "page" && node.url === url) ??
    (tree.fallback && findPath(tree.fallback.children, (node) => node.type === "page" && node.url === url));
  const parent = trail?.at(-2);
  const level =
    parent?.type === "folder" ? parent.children : [...tree.children, ...(root ? (tree.fallback?.children ?? []) : [])];

  return level.filter(
    (node): node is Extract<Node, { type: "page" | "folder" }> =>
      node.type === "page" || (node.type === "folder" && Boolean(node.index)),
  );
}

function hrefOf(node: Node) {
  if (node.type === "page") return node.url;
  if (node.type === "folder") return node.index?.url ?? "#";
  return "#";
}
