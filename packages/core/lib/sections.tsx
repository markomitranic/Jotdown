import type { CSSProperties, ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import type { LayoutTab } from "@jotdown/core/components/docs/tabs";

/**
 * The sections the sidebar switcher offers: the main tree, then every folder with its own sidebar.
 *
 * A section is a body of pages with its own sidebar. Every folder carrying
 * `"root": true` is one, and so is the main tree, which no folder declares.
 * Binding each row to its folder would and then show a reader only the
 * sections sitting beside the one they are in, so these are bound by URL
 * instead and the same rows appear in every scope.
 *
 * `base` is where the tree's addresses start, the project's `/owner/repo` in the studio.
 *
 * @example sectionTabs(tree); // [{ title: "Guide", … }, { title: "Reference", … }]
 */
export function sectionTabs(tree: PageTree.Root, base = ""): LayoutTab[] {
  const root = base || "/";
  const home = tree.children.find((node) => node.type === "page" && node.url === root);

  const main: LayoutTab = {
    title: tree.name,
    description: tree.description,
    icon: (
      <SectionIcon url={root} base={base}>
        {home?.icon}
      </SectionIcon>
    ),
    url: root,
    urls: pageUrls(tree),
  };

  const sections = rootFolders(tree)
    .map((folder) => sectionOf(folder, base))
    .filter(isTab);

  return [main, ...sections];
}

/**
 * Sorts the held-out sections into the order the main tree's `meta.json` names them.
 *
 * Fumadocs collects every folder held out with `!name` by its folder name, so
 * without this the switcher lists sections alphabetically. A section nobody
 * names keeps its place after the named ones. Sorts the tree in place.
 *
 * @example orderSections(tree, ["index", "!reference", "!examples"]); // Reference before Examples
 */
export function orderSections(tree: PageTree.Root, pages: string[] = []) {
  const held = pages.filter((row) => row.startsWith("!")).map((row) => `/${row.slice(1)}`);

  const rank = (node: PageTree.Node) => {
    const url = node.type === "folder" ? landingOf(node) : undefined;
    const at = url ? held.findIndex((name) => url.endsWith(name)) : -1;
    return at === -1 ? held.length : at;
  };

  tree.fallback?.children.sort((a, b) => rank(a) - rank(b));
}

/**
 * The CSS accent a URL's section is painted in, as a `var()` chain.
 *
 * The token is named after the first path segment under the project's base, so
 * colouring a new section means one line in the theme and no code. A section nobody has
 * coloured falls back to the site accent, and the chain ends at `--primary`
 * rather than at the colour token this value is assigned to, because a custom
 * property that names itself anywhere in its own value is a cycle and computes
 * to nothing.
 *
 * @example sectionAccent("/manual/edit-locks"); // "var(--jd-section-manual, …)"
 * @example sectionAccent("/you/notes/manual", "/you/notes"); // "var(--jd-section-manual, …)"
 */
export function sectionAccent(pathname: string, base = "") {
  const home = "var(--jd-section-home, var(--primary))";
  const inside = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const segment = inside.split("/")[1]?.replace(/[^a-zA-Z0-9-]/g, "");

  return segment ? `var(--jd-section-${segment}, ${home})` : home;
}

/**
 * A section's icon, boxed and tinted in that section's accent.
 *
 * Nothing without an icon, because an empty tinted box reads as a rendering
 * fault. The dropdown hides the slot when this draws nothing.
 */
function SectionIcon({ url, base, children }: { url: string; base: string; children?: ReactNode }) {
  if (!children) return null;

  return (
    <span className="jd-section-icon" style={{ "--jd-section": sectionAccent(url, base) } as CSSProperties}>
      {children}
    </span>
  );
}

/** One switcher row, or nothing for a section with no page to open. */
function sectionOf(folder: PageTree.Folder, base: string): LayoutTab | undefined {
  const url = landingOf(folder);
  if (!url) return undefined;

  const urls = pageUrls(folder);
  urls.add(url);

  return {
    title: folder.name,
    description: folder.description,
    icon: (
      <SectionIcon url={url} base={base}>
        {folder.icon}
      </SectionIcon>
    ),
    url,
    urls,
  };
}

/** The page a section opens on: its index, or its first page. */
function landingOf(folder: PageTree.Folder) {
  const first = folder.children.find((node) => node.type === "page");
  return folder.index?.url ?? (first?.type === "page" ? first.url : undefined);
}

/**
 * Every root folder, wherever it sits.
 *
 * The fallback tree is where a folder excluded from its parent's `pages` ends
 * up, which is how a section keeps its own sidebar without also appearing as a
 * row inside the section above it.
 */
function rootFolders(tree: PageTree.Root) {
  const found: PageTree.Folder[] = [];

  function walk(nodes: PageTree.Node[]) {
    for (const node of nodes) {
      if (node.type !== "folder") continue;
      if (node.root) found.push(node);
      else walk(node.children);
    }
  }

  walk(tree.children);
  if (tree.fallback) walk(tree.fallback.children);

  return found;
}

/** The pages a section owns, which is how the switcher knows where the reader is. */
function pageUrls(node: { children: PageTree.Node[] }, urls = new Set<string>()) {
  for (const child of node.children) {
    if (child.type === "page") urls.add(child.url);
    if (child.type !== "folder" || child.root) continue;
    if (child.index) urls.add(child.index.url);
    pageUrls(child, urls);
  }

  return urls;
}

function isTab(tab: LayoutTab | undefined): tab is LayoutTab {
  return tab !== undefined;
}
