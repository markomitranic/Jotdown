import type * as PageTree from "fumadocs-core/page-tree";

/**
 * One page, folder or group of a project, as the page picker lists it. A folder opens at its own page when it has one.
 *
 * `path` is the file behind the page, for the studio to add beside or delete, and null where it may not: a group, a
 * folder with no page of its own, or a page code writes.
 */
export type PageOutline = { title: string; url: string | null; path: string | null; children: PageOutline[] };

/** The file behind each page the studio may change, keyed by the URL it is served at. */
type Files = Record<string, string>;

/**
 * A project's page tree as plain data, in the sidebar's order, without its icons.
 *
 * A separator in `meta.json`, `---Studio---`, becomes a group holding the pages
 * after it, as the sidebar draws it. The sections `meta.json` holds out of the
 * main list with `!name` follow the main tree, each as the folder it is.
 *
 * @example pageOutline(source.getPageTree(), { "/how-it-works": "docs/how-it-works.mdx" }); // [{ title: "How it works", url: "/how-it-works", path: "docs/how-it-works.mdx", children: [ … ] }]
 */
export function pageOutline(tree: PageTree.Root, files: Files = {}): PageOutline[] {
  return [...outlineOf(tree.children, files), ...outlineOf(tree.fallback?.children ?? [], files)];
}

/** One level of the tree, each separator gathering the nodes after it up to the next one. */
function outlineOf(nodes: PageTree.Node[], files: Files): PageOutline[] {
  const outline: PageOutline[] = [];
  let group: PageOutline | null = null;

  for (const node of nodes) {
    if (node.type === "separator") {
      group = { title: titleOf(node.name, ""), url: null, path: null, children: [] };
      outline.push(group);
      continue;
    }
    const entry = entryOf(node, files);
    if (entry) (group?.children ?? outline).push(entry);
  }

  return outline.filter((entry) => entry.url !== null || entry.children.length > 0);
}

/** A page, or a folder with what it holds, or nothing for a link to another site. */
function entryOf(node: PageTree.Item | PageTree.Folder, files: Files): PageOutline | null {
  if (node.type === "page")
    return node.external
      ? null
      : { title: titleOf(node.name, node.url), url: node.url, path: files[node.url] ?? null, children: [] };

  const url = node.index?.url ?? null;
  const path = url === null ? null : (files[url] ?? null);
  return { title: titleOf(node.name, url ?? ""), url, path, children: outlineOf(node.children, files) };
}

/** A node's name as text, or its address when the name is drawn rather than written. */
function titleOf(name: PageTree.Node["name"], url: string) {
  return typeof name === "string" ? name : url;
}
