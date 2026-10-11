import type * as PageTree from "fumadocs-core/page-tree";
import type { Source } from "@jotdown/core/components/CompiledPage";
import type { Session } from "@/server/auth/session";
import type { StudioProject } from "@/server/storage";
import { DOCS_ROOT, dirOf, isSectionIndex, linkIn, separatorIn } from "@jotdown/core/lib/paths";
import type { DocEntry, LiveEditGlobalData } from "@jotdown/editor/types";

/**
 * Every doc keyed by the URL it is served at, from the same source the pages
 * render from, so a page the editor can see is by definition a page the site
 * built. `source` is the repo-relative file path the API writes to.
 */
function indexDocs(source: Source): Record<string, DocEntry> {
  const entries: Record<string, DocEntry> = {};
  for (const page of source.getPages()) {
    entries[page.url] = {
      source: `${DOCS_ROOT}/${page.path}`,
      title: page.data.title ?? "",
      generated: page.data.generated,
    };
  }
  return entries;
}

/**
 * Every sidebar link and separator as written, keyed by the folder whose `meta.json` holds it.
 *
 * Read off the tree the sidebar is drawn from rather than off disk, so an entry
 * the arranger can move is by definition one the site rendered. A folder
 * holding none is left out entirely, which is most of them.
 *
 * The held-out sections live in the fallback tree, the same place the section
 * switcher finds them, so a link inside one is not invisible here.
 */
function indexEntries(source: Source): Record<string, string[]> {
  const entries: Record<string, string[]> = {};

  const read = (node: PageTree.Root | PageTree.Folder) => {
    const meta = source.getNodeMeta(node);
    const spelt = (meta?.data.pages ?? []).filter((entry) => linkIn(entry) !== null || separatorIn(entry) !== null);

    if (meta && spelt.length > 0) entries[dirOf(`${DOCS_ROOT}/${meta.path}`)] = spelt;

    for (const child of node.children) if (child.type === "folder") read(child);
  };

  const tree = source.getPageTree();
  read(tree);
  if (tree.fallback) read(tree.fallback);

  return entries;
}

/**
 * The Lucide name every page and folder is drawn with, keyed by repo path.
 *
 * A folder follows Fumadocs' own rule, its `meta.json` icon and otherwise its
 * landing page's.
 */
function indexIcons(source: Source): Record<string, string> {
  const icons: Record<string, string> = {};

  for (const page of source.getPages()) {
    const path = `${DOCS_ROOT}/${page.path}`;
    if (!page.data.icon || page.data.problem) continue;

    icons[path] = page.data.icon;
    if (isSectionIndex(path)) icons[dirOf(path)] ??= page.data.icon;
  }

  const read = (node: PageTree.Root | PageTree.Folder) => {
    const meta = source.getNodeMeta(node);

    if (meta?.data.icon) icons[dirOf(`${DOCS_ROOT}/${meta.path}`)] = meta.data.icon;

    for (const child of node.children) if (child.type === "folder") read(child);
  };

  const tree = source.getPageTree();
  read(tree);
  if (tree.fallback) read(tree.fallback);

  return icons;
}

/**
 * What the browser needs to know to offer editing: the project's API prefix,
 * whether saving is possible, who is editing, and where every page lives.
 * Computed on the server and handed to the client once, at the root of the app.
 */
export function liveEditConfig(project: StudioProject, session: Session, source: Source): LiveEditGlobalData {
  return {
    apiBase: `/api/projects/${project.id}/live-edit`,
    base: project.base,
    editable: true,
    local: project.key.startsWith("local/"),
    identity: { name: session.editor.name, email: session.editor.email },
    docs: indexDocs(source),
    entries: indexEntries(source),
    icons: indexIcons(source),
    version: project.version,
  };
}
