import type * as PageTree from "fumadocs-core/page-tree";

/** One page as a list of pages shows it: its title, its address, its file and its front matter. */
export type ListedPage = {
  title: string;
  description?: string;
  url: string;
  path: string;
  data: Record<string, unknown>;
};

/** What the tree does not say about a page: its file and its front matter, looked up by its address. */
export type PageFile = (url: string) => { path: string; data: Record<string, unknown> } | undefined;

/**
 * Every page of a tree in the sidebar's order, a folder's own page before the pages inside it.
 *
 * A page whose file cannot be looked up is left out, since it is not one the site built.
 *
 * @example pageList(source.getPageTree(), fileOf); // [{ title: "Welcome", url: "/", path: "docs/index.mdx", data: {} }, …]
 */
export function pageList(tree: PageTree.Root | PageTree.Folder, fileOf: PageFile): ListedPage[] {
  return tree.children.flatMap((node): ListedPage[] => {
    if (node.type === "page" && !node.external) return listed(node, fileOf);
    if (node.type !== "folder") return [];
    return [...(node.index ? listed(node.index, fileOf) : []), ...pageList(node, fileOf)];
  });
}

function listed(page: PageTree.Item, fileOf: PageFile): ListedPage[] {
  const file = fileOf(page.url);
  if (!file) return [];

  const description = typeof page.description === "string" ? page.description : undefined;
  return [{ title: typeof page.name === "string" ? page.name : page.url, description, url: page.url, ...file }];
}
