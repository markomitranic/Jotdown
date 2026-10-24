import type * as PageTree from "fumadocs-core/page-tree";

/** One page, folder or group of a project, as the page picker lists it. A folder opens at its own page when it has one. */
export type PageOutline = { title: string; url: string | null; children: PageOutline[] };

/**
 * A project's page tree as plain data, in the sidebar's order, without its icons.
 *
 * A separator in `meta.json`, `---Studio---`, becomes a group holding the pages
 * after it, as the sidebar draws it. The sections `meta.json` holds out of the
 * main list with `!name` follow the main tree, each as the folder it is.
 *
 * @example pageOutline(source.getPageTree()); // [{ title: "Getting started", url: null, children: [ … ] }, { title: "How it works", url: "/how-it-works", children: [ … ] }]
 */
export function pageOutline(tree: PageTree.Root): PageOutline[] {
  return [...outlineOf(tree.children), ...outlineOf(tree.fallback?.children ?? [])];
}

/** One level of the tree, each separator gathering the nodes after it up to the next one. */
function outlineOf(nodes: PageTree.Node[]): PageOutline[] {
  const outline: PageOutline[] = [];
  let group: PageOutline | null = null;

  for (const node of nodes) {
    if (node.type === "separator") {
      group = { title: titleOf(node.name, ""), url: null, children: [] };
      outline.push(group);
      continue;
    }
    const entry = entryOf(node);
    if (entry) (group?.children ?? outline).push(entry);
  }

  return outline.filter((entry) => entry.url !== null || entry.children.length > 0);
}

/** A page, or a folder with what it holds, or nothing for a link to another site. */
function entryOf(node: PageTree.Item | PageTree.Folder): PageOutline | null {
  if (node.type === "page")
    return node.external ? null : { title: titleOf(node.name, node.url), url: node.url, children: [] };

  const url = node.index?.url ?? null;
  return { title: titleOf(node.name, url ?? ""), url, children: outlineOf(node.children) };
}

/** A node's name as text, or its address when the name is drawn rather than written. */
function titleOf(name: PageTree.Node["name"], url: string) {
  return typeof name === "string" ? name : url;
}
