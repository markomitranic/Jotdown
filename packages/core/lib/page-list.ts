import type * as PageTree from "fumadocs-core/page-tree";

/** One page as a list of pages shows it. */
export type ListedPage = { title: string; description?: string; url: string };

/**
 * Every page of a tree in the sidebar's order, a folder's own page before the pages inside it.
 *
 * @example pageList(source.getPageTree()); // [{ title: "Welcome", url: "/" }, { title: "Setup", url: "/guides/setup" }, …]
 */
export function pageList(tree: PageTree.Root | PageTree.Folder): ListedPage[] {
  return tree.children.flatMap((node): ListedPage[] => {
    if (node.type === "page" && !node.external) return [listed(node)];
    if (node.type !== "folder") return [];
    return [...(node.index ? [listed(node.index)] : []), ...pageList(node)];
  });
}

function listed(page: PageTree.Item): ListedPage {
  const description = typeof page.description === "string" ? page.description : undefined;
  return { title: typeof page.name === "string" ? page.name : page.url, description, url: page.url };
}
