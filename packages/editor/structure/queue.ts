/**
 * The staged queue, and the sidebar as it will look once the queue is saved.
 *
 * Pure. Nothing here talks to the network or touches React, which is what makes
 * "create a section, move two pages into it, rename one of them" something you
 * can hold in your head and write a test for.
 *
 * The queue is the only state. Everything the reader sees while staging is
 * derived from it by replaying it, rather than kept alongside it, so undoing the
 * last change is dropping the last op and nothing else.
 */

import type * as PageTree from "fumadocs-core/page-tree";
import {
  DOCS_ROOT,
  dirOf,
  isDoc,
  isSectionIndex,
  leavesTheSite,
  linkIn,
  linkOf,
  nestedIndex,
  sectionIndex,
  separatorIn,
  separatorOf,
  slugify,
  stemOf,
} from "@jotdown/core/lib/paths";
import type { DocEntry, StructureOp } from "../types";

/**
 * A page-tree node, plus the marker stamped on rows with no node of their own.
 *
 * Every published node finds its file by looking its URL up in the doc index.
 * Four kinds of row cannot: one the queue created a moment ago, which is not
 * in the index yet, an extracted folder, which the page tree threw away when it
 * inlined the children, a folder with no landing page to look up, and a link or
 * a separator, which has no file anywhere and is only ever one entry in one
 * `pages` array. Rather than teach every caller about all four, such a row says
 * what it is on the way past.
 */
export type TreeNode = PageTree.Node & {
  liveEdit?: Invented;
  /** An icon the queue has chosen, as a Lucide name, or null once it was taken away. */
  liveIcon?: string | null;
};

type Invented =
  | {
      kind: "page" | "section";
      path: string;
      /** Set on an extracted folder, which its parent's order spells as `...folder` and the editor leaves where it is. */
      pinned?: true;
    }
  | { kind: "link" | "separator"; entry: string };

/** One thing the queue is keeping track of, page or section. */
type Tracked = {
  /**
   * A folder is a `section` whether or not it has a landing page, and a page
   * becomes one the moment it is given pages of its own.
   */
  kind: "page" | "section";
  /** Its path before the queue touched it, or null when the queue made it. */
  origin: string | null;
  /** Where it is now, or null once it has been deleted. A section is a folder. */
  at: string | null;
  label: string | null;
  /** An icon the queue has chosen, null for none, and absent while untouched. */
  icon?: string | null;
  /** Whether a section starts unfolded, absent while untouched. */
  open?: boolean;
};

/**
 * Replays a queue into what it will have done, once.
 *
 * Everything else in this file reads a projection rather than the ops, because
 * a page that was created, renamed and then moved is three ops and one row in
 * the sidebar.
 *
 * @example project([{ kind: "create", path: "docs/a.md", title: "A", description: null }])
 */
export function project(ops: StructureOp[]): Tracked[] {
  const tracked: Tracked[] = [];

  const find = (kind: Tracked["kind"], at: string) => tracked.find((entry) => entry.kind === kind && entry.at === at);

  const touch = (kind: Tracked["kind"], at: string): Tracked => {
    const found = find(kind, at);
    if (found) return found;

    const fresh: Tracked = { kind, origin: at, at, label: null };
    tracked.push(fresh);
    return fresh;
  };

  for (const op of ops) {
    switch (op.kind) {
      case "create":
        tracked.push({ kind: "page", origin: null, at: op.path, label: op.title, icon: op.icon ?? undefined });
        break;

      case "nest": {
        const entry = touch("page", op.path);
        entry.kind = "section";
        entry.at = holderOf(op.path);
        break;
      }

      case "rename":
        touch("page", op.path).label = op.title;
        break;

      case "renameSection":
        touch("section", op.path).label = op.label;
        break;

      case "move":
        touch("page", op.from).at = op.to;
        break;

      case "moveSection":
        touch("section", op.from).at = op.to;
        break;

      case "icon":
        touch(isDoc(op.path) ? "page" : "section", op.path).icon = op.icon;
        break;

      case "defaultOpen":
        touch("section", op.path).open = op.open;
        break;

      case "delete": {
        const entry = touch(isDoc(op.path) ? "page" : "section", op.path);
        entry.at = null;
        break;
      }
    }
  }

  return tracked;
}

/**
 * The queue with its last change taken back, and the page that change had made a folder.
 *
 * A page becomes a folder only to hold the thing just put inside it, so the two
 * are one change to the reader and go away together.
 *
 * @example undone([{ kind: "nest", path: "docs/a.mdx" }, create]); // []
 */
export function undone(ops: StructureOp[]): StructureOp[] {
  const kept = ops.slice(0, -1);
  while (kept.at(-1)?.kind === "nest") kept.pop();
  return kept;
}

/**
 * How many changes a queue holds, counted the way the reader made them.
 *
 * @example changesIn([{ kind: "nest", path: "docs/a.mdx" }, create]); // 1
 */
export function changesIn(ops: StructureOp[]) {
  return ops.filter((op) => op.kind !== "nest").length;
}

/**
 * What the queue has done to one sidebar row.
 *
 * `renamed` is a new title and nothing else. `url` is a new address, which is
 * the one that drags link repair and a redirect behind it, so the two are worth
 * telling apart on the row.
 */
export type Pending = "created" | "moved" | "renamed" | "url" | "icon" | "open" | "deleted" | null;

/**
 * What a sidebar row stands for.
 *
 * A `separator` is a label drawn over whatever pages follow it, and a `link`
 * points somewhere the page tree does not own. Both live entirely in their
 * folder's order. `other` is a folder nothing names a file for, which this
 * endpoint has no way to move.
 */
export type RowKind = "page" | "section" | "separator" | "link" | "other";

/** What the `+` on a row, and the buttons under the tree, can add. */
export type NewThing = "page" | "separator";

/** True for a row that is one entry in its folder's order and nothing else. */
export function isSpelt(kind: RowKind) {
  return kind === "link" || kind === "separator";
}

/** Which of the two things the queue keeps track of a row as, or neither. */
function trackedAs(kind: RowKind): Tracked["kind"] | null {
  if (kind === "page" || kind === "section") return kind;
  return null;
}

/**
 * The sidebar as it will be once the queue is saved.
 *
 * A move is a detach and a re-attach: the row comes out of the category it was
 * in and goes into the one it is headed for, so the reader sees the result
 * rather than a note about it. That is the whole reason for staging. Somebody
 * moving three pages needs to see the shape they are making, not a to-do list.
 *
 * Two passes, and the second one is not optional. Detaching and re-attaching in
 * one walk works only when a page moves to a section the walk has not reached
 * yet; a page moved into an earlier section would be detached after its new
 * home had already been drawn, and would simply disappear. So the first pass
 * takes rows out and the second puts them back.
 *
 * Rows the queue has not touched come through untouched, including their
 * collapsed state, so nothing shifts under the reader while they work.
 *
 * `root` is the folder the level sits in, which is `docs` at the docs root and
 * the section's own folder inside a `"root": true` section. Read it off the tree
 * with `levelFolder`.
 */
export function stage(
  items: readonly TreeNode[],
  ops: StructureOp[],
  docs: Record<string, DocEntry>,
  root = DOCS_ROOT,
): TreeNode[] {
  if (ops.length === 0) return [...items];

  const tracked = project(ops);
  const homeOf = (path: string) => tracked.find((entry) => entry.origin === path);

  const arrivals = new Map<string, TreeNode[]>();

  /**
   * Where a row will be once the queue lands, which is where things arriving
   * are addressed to. A section that has itself moved receives into its new
   * folder, not the one it is drawn in.
   */
  const finalFolder = (node: TreeNode, fallback: string) => {
    const path = pathOf(node, docs);
    if (!path) return fallback;

    return trackedAs(kindOf(node)) === "section" ? (homeOf(path)?.at ?? path) : path;
  };

  const prune = (level: readonly TreeNode[], folder: string): TreeNode[] =>
    level.flatMap((node) => {
      const path = pathOf(node, docs);
      const moved = trackedAs(kindOf(node)) === null || !path ? undefined : homeOf(path);

      const walked =
        node.type === "folder" ? { ...node, children: prune(node.children, finalFolder(node, folder)) } : node;

      if (!moved) return [walked];
      if (moved.at === null) return [];

      const named = restyled(moved.kind === "section" ? holding(walked, path as string) : walked, moved);
      if (moved.at === restingAt(moved)) return [named];

      arrivals.set(dirOf(moved.at), [...(arrivals.get(dirOf(moved.at)) ?? []), named]);
      return [];
    });

  const settle = (level: readonly TreeNode[], folder: string): TreeNode[] => {
    const here = [...level, ...(arrivals.get(folder) ?? [])];
    const kept = here.map((node) =>
      node.type === "folder" ? { ...node, children: settle(node.children, finalFolder(node, folder)) } : node,
    );

    return [...kept, ...born(tracked, folder, arrivals)];
  };

  return sorted(relinked(settle(prune(items, root), root), root, ops, docs), root, ops, docs);
}

/**
 * A page drawn as the landing page of the folder it is about to become.
 *
 * It keeps its own name, icon and address, so the row looks no different until
 * something is put inside it. The path it carries is the page's, which the
 * staged path follows into the folder it now names.
 */
function holding(node: TreeNode, path: string): TreeNode {
  if (node.type !== "page") return node;

  return {
    type: "folder",
    name: node.name,
    icon: node.icon,
    index: node,
    children: [],
    liveIcon: node.liveIcon,
    liveEdit: { kind: "section", path },
  };
}

/**
 * Where a tracked thing stands if it has not moved.
 *
 * A page made to hold pages counts as unmoved in the folder named after it,
 * because it keeps its address and its place.
 */
function restingAt(entry: Tracked) {
  const nested = entry.kind === "section" && entry.origin !== null && isDoc(entry.origin);
  return nested ? holderOf(entry.origin as string) : entry.origin;
}

/**
 * The folder a page becomes once it holds pages of its own.
 *
 * @example holderOf("docs/guides/setup.mdx"); // "docs/guides/setup"
 */
export function holderOf(path: string) {
  return dirOf(nestedIndex(path));
}

/** A node wearing whatever name, icon and fold the queue has given it. */
function restyled(node: TreeNode, entry: Tracked): TreeNode {
  const named = entry.label ? { ...node, name: entry.label } : node;
  const painted = entry.icon === undefined ? named : { ...named, liveIcon: entry.icon };

  return entry.open === undefined || painted.type !== "folder" ? painted : { ...painted, defaultOpen: entry.open };
}

/**
 * Puts each level in the order the queue's `reorder` ops asked for.
 *
 * Runs after everything has been detached and re-attached, and that order
 * matters: a page arriving from another section is appended to it, and the
 * reorder is what says where in its new home it actually goes. Without this pass
 * a page dragged into the middle of a section would preview at the bottom of it
 * and then land in the middle after the deploy, which reads as the editor
 * ignoring the drop.
 *
 * Anything the array does not name keeps the place it had, after everything the
 * array does name, which is the same rule the trailing `"..."` in a `meta.json`
 * applies at build time.
 */
function sorted(level: TreeNode[], folder: string, ops: StructureOp[], docs: Record<string, DocEntry>): TreeNode[] {
  const walked = level.map((node) =>
    node.type === "folder"
      ? { ...node, children: sorted(node.children, levelOf(node, folder, ops, docs), ops, docs) }
      : node,
  );

  const wanted = latestOrder(ops, folder);
  if (!wanted) return walked;

  return walked
    .map((node, fallback) => {
      const token = tokenOf(node, ops, docs);
      const rank = token === null ? -1 : wanted.indexOf(token);

      return { node, rank: rank === -1 ? wanted.length : rank, fallback };
    })
    .sort((a, b) => a.rank - b.rank || a.fallback - b.fallback)
    .map(({ node }) => node);
}

/**
 * Puts each level's links and separators back as the latest order names them.
 *
 * Neither is something the two passes above can carry around, because there is
 * no file to detach and re-attach: the whole of one is an entry in one `pages`
 * array, and every change to them is that array spelt out again in full. So a
 * level the queue has an order for simply loses the ones the tree drew and
 * gains the ones the order names, which is what makes adding one, respelling
 * it, dragging it elsewhere and deleting it the same op. `sorted` then puts
 * them where the order says, along with everything else.
 *
 * A folder the queue has said nothing about keeps the ones it came with.
 */
function relinked(level: TreeNode[], folder: string, ops: StructureOp[], docs: Record<string, DocEntry>): TreeNode[] {
  const walked = level.map((node) =>
    node.type === "folder"
      ? { ...node, children: relinked(node.children, levelOf(node, folder, ops, docs), ops, docs) }
      : node,
  );

  const wanted = latestOrder(ops, folder);
  if (!wanted) return walked;

  return [...walked.filter((node) => !isSpelt(kindOf(node))), ...wanted.flatMap((entry) => spelledNode(entry) ?? [])];
}

/** The folder a node's own children sit in, for a walk that is tracking levels. */
function levelOf(node: TreeNode, fallback: string, ops: StructureOp[], docs: Record<string, DocEntry>) {
  const origin = pathOf(node, docs);

  return (origin === null ? null : stagedPath(ops, origin)) ?? fallback;
}

/** The last order the queue asked for in a folder, or null when it asked for none. */
function latestOrder(ops: StructureOp[], folder: string) {
  return ops.reduce<string[] | null>(
    (found, op) => (op.kind === "reorder" && (stagedPath(ops, op.folder) ?? op.folder) === folder ? op.names : found),
    null,
  );
}

/**
 * The row a link or separator entry draws as, or nothing for a file's name.
 *
 * A link's `external` is set because the page tree only carries it for an
 * entry that asked for it by name, and a preview row that navigated in-app
 * would be promising something the saved sidebar does not do.
 */
function spelledNode(entry: string): TreeNode | null {
  const link = linkIn(entry);
  if (link) {
    return { type: "page", name: link.label, url: link.url, external: true, liveEdit: { kind: "link", entry } };
  }

  const separator = separatorIn(entry);
  if (separator) return { type: "separator", name: separator.label, liveEdit: { kind: "separator", entry } };

  return null;
}

/**
 * What a node is called in the `pages` array of the folder it sits in.
 *
 * A file goes by its basename, wherever the queue has since moved it to. A link
 * or a separator goes by the whole entry it is spelt as, because that spelling
 * is the only thing it is. An extracted folder is spelt `...folder`, which the
 * editor leaves where it stands, and anything else has no name in an order at all.
 */
function tokenOf(node: TreeNode, ops: StructureOp[], docs: Record<string, DocEntry>): string | null {
  if (node.liveEdit && "entry" in node.liveEdit) return node.liveEdit.entry;
  if (node.liveEdit?.pinned) return null;

  const origin = pathOf(node, docs);
  const path = origin === null ? null : stagedPath(ops, origin);

  return path === null ? null : stemOf(path);
}

/**
 * Rows for pages and sections this queue invented, which have no node yet.
 *
 * Their `url` is empty, because the page they will be served at does not exist
 * until the deploy lands and a link to a 404 reads as the editor having dropped
 * the page. `liveEdit` carries the path instead, which is what the four
 * functions that ask a row for its file read.
 */
function born(tracked: Tracked[], folder: string, arrivals: Map<string, TreeNode[]>): TreeNode[] {
  return tracked
    .filter((entry) => entry.origin === null && entry.at !== null && dirOf(entry.at) === folder)
    .map((entry) => ({ ...entry, at: entry.at as string }))
    .map((entry): TreeNode => {
      if (entry.kind === "page") {
        return {
          type: "page",
          name: entry.label ?? "Untitled",
          url: "",
          liveEdit: { path: entry.at, kind: "page" },
          liveIcon: entry.icon,
        };
      }

      return {
        type: "folder",
        name: entry.label ?? "Untitled",
        children: [...(arrivals.get(entry.at) ?? []), ...born(tracked, entry.at, arrivals)],
        liveEdit: { path: entry.at, kind: "section" },
        liveIcon: entry.icon,
        defaultOpen: entry.open,
      };
    });
}

/**
 * Folds every run of inlined rows back into the folder it came from.
 *
 * `...folder` in a `meta.json` draws that folder's contents in the parent's
 * list and throws the folder away, so the page tree hands the browser a flat
 * run of pages whose real home is somewhere else. Rebuilding the folder is what
 * lets one row stand for the run: without it the run is a set of pages whose
 * visual parent does not name the `meta.json` that orders them, and dragging
 * one would rewrite the wrong file.
 *
 * The rebuilt folder is pinned where its `...folder` entry stands, since moving
 * it would mean respelling an entry the editor does not write. `flatten` draws
 * no row for it, so the sidebar reads exactly as a publication's does, and its
 * pages can still be dragged in and out.
 *
 * @example refold(root.children, docs)
 */
export function refold(items: readonly TreeNode[], docs: Record<string, DocEntry>): TreeNode[] {
  const walk = (level: readonly TreeNode[], folder: string): TreeNode[] => {
    const out: TreeNode[] = [];

    for (const raw of level) {
      const node = unnamedFolder(raw, docs) ?? raw;
      const inside =
        node.type === "folder" ? { ...node, children: walk(node.children, pathOf(node, docs) ?? folder) } : node;

      const home = inlinedFrom(node, folder, docs);
      if (home === null) {
        out.push(inside);
        continue;
      }

      const holder = holderFor(out, home);
      if (node.type === "page" && isSectionIndex(pathOf(node, docs) ?? "")) {
        holder.index = node;
        holder.icon ??= node.icon;
        if (!nameOf(holder)) holder.name = nameOf(node);
        continue;
      }

      holder.children.push(inside);
    }

    return out.map((node) => {
      const invented = inventedFolder(node);

      return node.type === "folder" && !nameOf(node) && invented ? { ...node, name: stemOf(invented) } : node;
    });
  };

  return walk(items, levelFolder(items, docs));
}

/**
 * A folder with no landing page, given the path its children say it has.
 *
 * The core draws such a folder as an ordinary collapsible row, a changelog
 * split by major version being the usual one, but nothing in the node names its
 * folder: there is no `index` to look up. Its children do know where they live,
 * so the folder is stamped with the deepest folder they share and becomes a
 * section like any other, which can be dragged, dropped into and renamed.
 */
function unnamedFolder(node: TreeNode, docs: Record<string, DocEntry>): TreeNode | null {
  if (node.type !== "folder" || node.index || node.liveEdit || node.children.length === 0) return null;

  if (!node.children.some((child) => pathOf(child, docs))) return null;

  return { ...node, liveEdit: { kind: "section", path: levelFolder(node.children, docs) } };
}

/**
 * The folder a level sits in, read off the rows it holds.
 *
 * The top of a tree is not always the docs root: a section marked `"root": true`
 * gets a sidebar of its own, and its own children are then the level. Getting
 * that wrong would fold every row of such a sidebar into one made-up folder.
 *
 * So it is asked of the rows rather than of Fumadocs, which knows only in a
 * field it marks internal: the answer is the deepest folder every row at the
 * level lives under, which is `docs` at the docs root and the section's own
 * folder inside a root section.
 *
 * A level holding nothing but one extracted folder answers with that folder,
 * so it is left flat. Harmless, since there is nothing beside it to order.
 *
 * @example levelFolder(root.children, docs); // "docs/site-internals"
 */
export function levelFolder(items: readonly TreeNode[], docs: Record<string, DocEntry>) {
  const homes = items.flatMap((node) => {
    const path = pathOf(node, docs);
    return path === null ? [] : [dirOf(path).split("/")];
  });

  const [first, ...rest] = homes;
  if (!first) return DOCS_ROOT;

  const shared = rest.reduce((kept, other) => {
    const at = kept.findIndex((segment, index) => other[index] !== segment);
    return at === -1 ? kept : kept.slice(0, at);
  }, first);

  return shared.join("/") || DOCS_ROOT;
}

/**
 * The folder a row really lives in, when that is not the one it is drawn in.
 *
 * Null for every ordinary row, and for a separator or an external link, neither
 * of which has a file to be drawn away from.
 */
function inlinedFrom(node: TreeNode, folder: string, docs: Record<string, DocEntry>) {
  const path = pathOf(node, docs);
  if (path === null) return null;

  const home = dirOf(path);
  return home === folder ? null : home;
}

/**
 * The row a run of inlined children hangs under, opened if it is not there yet.
 *
 * Mutable on purpose: a run arrives one child at a time and the holder is a node
 * this pass invented, so filling it in as the run goes is the whole walk.
 */
function holderFor(out: TreeNode[], home: string): PageTree.Folder & { liveEdit?: Invented } {
  const last = out.at(-1);
  if (last?.type === "folder" && inventedFolder(last) === home) return last;

  const holder: PageTree.Folder & { liveEdit?: Invented } = {
    type: "folder",
    name: "",
    children: [],
    liveEdit: { path: home, kind: "section", pinned: true },
  };

  out.push(holder);
  return holder;
}

/**
 * The folder an invented row stands for, and nothing for a link or a separator.
 *
 * @example inventedFolder(holder); // "docs/site-internals"
 */
function inventedFolder(node: TreeNode) {
  return node.liveEdit && "path" in node.liveEdit ? node.liveEdit.path : undefined;
}

/**
 * The folder a `...folder` entry drew inline, for the row `refold` rebuilt to hold it.
 *
 * @example extractedFolder(holder); // "docs/studio"
 */
function extractedFolder(node: TreeNode) {
  return node.liveEdit && "pinned" in node.liveEdit ? node.liveEdit.path : undefined;
}

/**
 * What one row is, in the queue's terms.
 *
 * A folder with an `index` is a section, because that index is its `index.mdx`.
 * One without has nothing to name its folder until `refold` stamps it, so an
 * unstamped one is `other`. A `[Text](url)` entry pointing off the site is a
 * link.
 */
export function kindOf(node: TreeNode): RowKind {
  if (node.liveEdit) return node.liveEdit.kind;

  if (node.type === "page") return isLink(node) ? "link" : "page";
  if (node.type === "separator") return "separator";
  if (node.type === "folder" && node.index) return "section";
  return "other";
}

/**
 * True for a page-tree row that is a hand-written link rather than a page here.
 *
 * Fumadocs sets `external` only when the entry was spelt `external:`, and
 * leaves it off a plain `https://` link because the renderer works that out
 * from the URL on its own. So both have to be asked about, and a link that
 * points at an address this site does happen to serve is still a link.
 */
function isLink(node: TreeNode) {
  return node.type === "page" && (node.external === true || leavesTheSite(node.url));
}

/**
 * The file a row stands for, or the folder when it is a section.
 *
 * @example pathOf(page, docs); // "docs/architecture/bff.mdx"
 */
export function pathOf(node: TreeNode, docs: Record<string, DocEntry>): string | null {
  if (node.liveEdit) return "path" in node.liveEdit ? node.liveEdit.path : null;
  if (isLink(node)) return null;

  const source = urlOf(node) ? docs[urlOf(node) as string]?.source : undefined;
  if (!source) return null;

  return node.type === "folder" ? dirOf(source) : source;
}

/** A row's own address: a page's, or the one its folder's `index.mdx` claims. */
function urlOf(node: TreeNode) {
  if (node.type === "page") return node.url;
  if (node.type === "folder") return node.index?.url;
  return undefined;
}

/**
 * A row's label as text.
 *
 * A page tree may carry a React node as a name; ours never does, and a row that
 * did would rather be blank than render `[object Object]` into a rename field.
 *
 * @example nameOf(page); // "BFF"
 */
export function nameOf(node: TreeNode): string {
  return typeof node.name === "string" ? node.name : "";
}

/**
 * Where a row's file sits after everything staged so far, or null once it is gone.
 *
 * A sidebar row keeps the href it was built with, so the path it can name is the
 * one that file had before the queue started. Every op after the first has to
 * name the path its predecessor left behind, or the endpoint is asked to rename
 * a page that is not there any more. A section moving takes the pages inside it
 * along, which is why this walks the ops instead of reading the projection.
 *
 * @example stagedPath([{ kind: "moveSection", from: "docs/a", to: "docs/b" }], "docs/a/x.md")
 */
export function stagedPath(ops: StructureOp[], path: string): string | null {
  let at: string | null = path;

  for (const op of ops) {
    if (at === null) return null;

    if (op.kind === "move" && op.from === at) at = op.to;
    if (op.kind === "nest" && op.path === at) at = holderOf(op.path);
    if (op.kind === "moveSection" && (at === op.from || at.startsWith(`${op.from}/`))) {
      at = `${op.to}${at.slice(op.from.length)}`;
    }
    if (op.kind === "delete" && op.path === at) at = null;
  }

  return at;
}

/** What the queue has staged for a given row, for the marker beside it. */
export function pendingFor(ops: StructureOp[], path: string | null): Pending {
  if (!path) return null;

  const entry = project(ops).find(({ origin, at }) => origin === path || (origin === null && at === path));
  if (!entry) return null;

  if (entry.origin === null) return "created";
  if (entry.at === null) return "deleted";

  const resting = restingAt(entry) as string;
  if (entry.at !== resting) return dirOf(entry.at) === dirOf(resting) ? "url" : "moved";

  if (entry.label !== null) return "renamed";
  if (entry.icon !== undefined) return "icon";
  return entry.open === undefined ? null : "open";
}

/**
 * One row of the sidebar, flattened out of the tree so a drag can reorder it.
 *
 * `folder` and `path` are both where the queue has left things, not where the
 * repo has them, because the next op has to be aimed at the tree the reader is
 * looking at.
 */
export type Row = {
  /** Unique in the list and stable across renders, which is what a drag needs. */
  id: string;
  node: TreeNode;
  kind: RowKind;
  /** Its path before the queue touched it, which the pending marker is keyed by. */
  origin: string | null;
  /** Where it sits now, or null for a row with no file behind it. */
  path: string | null;
  /**
   * What its folder's `pages` array calls it, or null when that array cannot
   * name it. A basename for a file, the whole entry for a link or a separator.
   */
  token: string | null;
  /** The folder it sits in now. */
  folder: string;
  depth: number;
  /** A section whose contents are being shown, and can therefore be dropped into. */
  open: boolean;
};

/**
 * The staged tree as one flat list, which is the shape a drag can reorder.
 *
 * A folder in `closed` has its contents left out. That covers both the sections
 * the reader has collapsed and the one being dragged, whose children travel
 * with it rather than being dropped into.
 *
 * An extracted folder draws no row of its own. Its pages sit at the level its
 * `...folder` entry stands at, exactly as the reading sidebar shows them, and
 * each still carries the folder it really lives in.
 *
 * Every row carries the folder it sits in, and the top level's is `root` rather
 * than always the docs root, because a `"root": true` section is a sidebar whose
 * first level is that section's own folder. Getting it wrong aims the drag's
 * reorder at the wrong `meta.json`.
 *
 * @example flatten(staged, docs, ops, new Set(["docs/tooling"]))
 */
export function flatten(
  items: readonly TreeNode[],
  docs: Record<string, DocEntry>,
  entries: Record<string, string[]>,
  ops: StructureOp[],
  closed: ReadonlySet<string>,
  root = DOCS_ROOT,
): Row[] {
  const walk = (level: readonly TreeNode[], folder: string, depth: number): Row[] =>
    level.flatMap((node, index) => {
      const extracted = extractedFolder(node);
      if (node.type === "folder" && extracted) {
        const home = stagedPath(ops, extracted) ?? extracted;
        return walk(node.index ? [node.index, ...node.children] : node.children, home, depth);
      }

      const origin = pathOf(node, docs);
      const path = origin === null ? null : stagedPath(ops, origin);
      const kind = kindOf(node);
      const open = kind === "section" && path !== null && !closed.has(path);
      const token = isSpelt(kind) ? entryOf(node, folder, entries) : tokenOf(node, ops, docs);

      const row: Row = {
        id: isSpelt(kind) ? `${folder}#${token ?? index}` : (path ?? `${folder}#${index}`),
        node,
        kind,
        origin,
        path,
        token,
        folder,
        depth,
        open,
      };

      const inside = node.type === "folder" && open && path ? walk(node.children, path, depth + 1) : [];
      return [row, ...inside];
    });

  return walk(items, root, 0);
}

/**
 * How a link or separator row is spelt in its folder's order.
 *
 * A row the queue invented carries its own spelling. One the page tree drew
 * does not: Fumadocs renders the icon into an element and keeps no record of
 * the entry, so it is matched back to the published index, a link by where it
 * points and then by what it says, a separator by its label. Respelling it from
 * the node instead would quietly drop an icon somebody wrote by hand.
 */
function entryOf(node: TreeNode, folder: string, entries: Record<string, string[]>): string | null {
  if (node.liveEdit && "entry" in node.liveEdit) return node.liveEdit.entry;

  const spelt = entries[folder] ?? [];

  if (node.type === "separator") {
    return spelt.find((entry) => separatorIn(entry)?.label === nameOf(node)) ?? null;
  }
  if (node.type !== "page") return null;

  const written = spelt.filter((entry) => linkIn(entry)?.url === node.url);

  return written.find((entry) => linkIn(entry)?.label === nameOf(node)) ?? written[0] ?? null;
}

/**
 * Where a dragged row would land: how far in, and the folder that is.
 *
 * `nest` is set when it lands inside a page with nothing in it yet, which has to
 * become a folder before anything can be put there.
 */
export type Drop = { depth: number; folder: string; nest?: string };

/**
 * Where a row being dragged would land, read the way it looks on screen.
 *
 * The vertical position picks the gap, and the horizontal distance travelled
 * picks how deep in that gap, one level per `step` pixels. The depth is held
 * between two limits the neighbours set: no deeper than inside the row above,
 * and no shallower than the row below, which would otherwise be cut off from
 * its own parent. The folder is then the one the neighbours at that depth live
 * in, or the nearest row above sitting one level up, or `root`. Any page can be
 * dropped into, and one holding nothing yet comes back as the folder it would become.
 *
 * A shut folder above can be dropped into, and the row lands at its end.
 *
 * @example projectDrop(rows, 3, 1, 24, 12, "docs"); // { depth: 1, folder: "docs/architecture" }
 */
export function projectDrop(
  rows: readonly Row[],
  from: number,
  to: number,
  offset: number,
  step: number,
  root = DOCS_ROOT,
): Drop {
  const dragged = rows[from];
  if (dragged === undefined) throw new Error(`No row at ${from} to drop`);

  const next = shift(rows, from, to);
  const above = next[to - 1];
  const below = next[to + 1];

  const deepest = above && holdsPages(above) ? above.depth + 1 : (above?.depth ?? 0);
  const shallowest = below ? Math.min(below.depth, deepest) : 0;
  const wanted = dragged.depth + Math.round(offset / step);
  const depth = Math.max(shallowest, Math.min(deepest, wanted));

  const nearest = next
    .slice(0, to)
    .reverse()
    .find((row) => row.depth <= depth);

  if (nearest?.depth === depth) return { depth, folder: siblingFolder(nearest, below, depth) };
  if (nearest?.kind === "page" && nearest.path) {
    return { depth, folder: holderOf(nearest.path), nest: nearest.path };
  }

  return { depth, folder: nearest?.path ?? root };
}

/**
 * The folder a row dropped beside `above` joins, which is the folder its neighbours live in.
 *
 * Asked of the neighbours rather than of the row one level up, because an
 * extracted folder's pages sit beside the parent's own with no row above them
 * naming their folder. A separator or a link belongs to the parent's order, so
 * a drop just under one joins whatever the row below it lives in.
 */
function siblingFolder(above: Row, below: Row | undefined, depth: number) {
  if (isSpelt(above.kind) && below?.depth === depth && !isSpelt(below.kind)) return below.folder;
  return above.folder;
}

/**
 * True for a row something can be put inside: a section, or any page but the home page.
 *
 * @example holdsPages(row); // true for "docs/setup.mdx"
 */
export function holdsPages(row: Row) {
  if (row.kind === "section") return row.path !== null;
  return row.kind === "page" && row.path !== null && row.token !== null && !isRoot(row.path);
}

/**
 * The ops one drop makes: where the row landed, and the order it landed in.
 *
 * `into` is the folder `projectDrop` settled on. Nothing but the dragged row
 * moves, so the destination's new order is the same list filtered down to that
 * folder. A move out of one folder needs no op for the folder it left, because
 * the endpoint takes a moved name out of its old array on its own.
 *
 * A row dropped into a shut folder is only moved, because the folder's own rows
 * are not in the list to be ordered around it, and the endpoint appends a moved
 * name to the end of an order it finds.
 *
 * A row dropped into a page with nothing in it yet makes that page a folder first.
 *
 * @example dropOps(rows, 6, 2, "docs/architecture") // dropped two rows up, into Architecture
 * @example dropOps(rows, 6, 2, "docs/setup", "docs/setup.mdx") // into a page holding nothing yet
 */
export function dropOps(rows: readonly Row[], from: number, to: number, into: string, nest?: string): StructureOp[] {
  const moved = rows[from];
  if (!moved?.token || isRoot(moved.path)) return [];
  if (moved.path && `${into}/`.startsWith(`${moved.path}/`)) return [];

  const ops = landing(rows, moved, from, to, into);
  return nest ? [{ kind: "nest", path: nest }, ...ops] : ops;
}

/** The ops that put one dragged row where it was dropped, in a folder that already exists. */
function landing(rows: readonly Row[], moved: Row, from: number, to: number, into: string): StructureOp[] {
  const next = shift(rows, from, to);
  const shut = next.some((row) => row.path === into && row.kind === "section" && !row.open);

  const names = (list: readonly Row[], folder: string) =>
    list
      .filter((row) => row.token !== null && (row.id === moved.id ? into : row.folder) === folder)
      .map((row) => row.token as string);

  const order: StructureOp = { kind: "reorder", folder: into, names: names(next, into) };

  if (into === moved.folder) {
    return names(rows, into).join("\n") === order.names.join("\n") ? [] : [order];
  }

  if (isSpelt(moved.kind)) {
    return [{ kind: "reorder", folder: moved.folder, names: names(next, moved.folder) }, order];
  }
  if (!moved.path) return [order];

  const relocate = moved.kind === "section" ? moveSectionOp(moved.path, into) : moveOp(moved.path, into);

  if (!relocate) return [order];
  return shut ? [relocate] : [relocate, order];
}

function shift<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * Where a new page inside a section would land.
 *
 * `.mdx`, because the slash menu puts components like `<VideoEmbed />` and
 * `<Whiteboard />` into a page, and a `.md` page renders every one of them as
 * nothing.
 *
 * @example newPagePath("docs/architecture", "Layered BFF"); // "docs/architecture/layered-bff.mdx"
 */
export function newPagePath(folder: string, title: string) {
  return `${folder}/${slugify(title)}.mdx`;
}

/**
 * The op that moves a page, or changes its address, or does both.
 *
 * `slug` is the new filename without its extension, which is what changing a
 * URL is. Left out, the page keeps the name it has. Either way its title is
 * untouched: renaming is its own op now.
 *
 * @example moveOp("docs/a/bff.mdx", "docs/b"); // moves it, same filename
 * @example moveOp("docs/a/bff.mdx", "docs/a", "Layered BFF"); // /a/layered-bff
 */
export function moveOp(from: string, toFolder: string, slug?: string): StructureOp | null {
  const extension = from.endsWith(".mdx") ? ".mdx" : ".md";
  const to = `${toFolder}/${slug ? slugify(slug) : stemOf(from)}${extension}`;

  return to === from ? null : { kind: "move", from, to };
}

/** The same, for a section, whose folder is what carries the address. */
export function moveSectionOp(from: string, toFolder: string, slug?: string): StructureOp | null {
  const to = `${toFolder}/${slug ? slugify(slug) : stemOf(from)}`;

  return to === from ? null : { kind: "moveSection", from, to };
}

/**
 * The op that gives a row a new title, and moves nothing.
 *
 * A separator's title is its whole entry, so renaming one respells it in its
 * folder's order and keeps its icon.
 *
 * @example renameOp(rows, row, "Getting started")
 */
export function renameOp(rows: readonly Row[], row: Row, name: string): StructureOp | null {
  if (row.kind === "separator") {
    const separator = row.token ? separatorIn(row.token) : null;
    return separator ? respellOp(rows, row, separatorOf(name, separator.icon)) : null;
  }

  if (!row.path) return null;
  if (row.kind === "section") return { kind: "renameSection", path: row.path, label: name };
  if (row.kind === "page") return { kind: "rename", path: row.path, title: name };
  return null;
}

/**
 * The op that gives a row a new icon, or takes its icon away.
 *
 * A link or a separator keeps its icon in the entry it is spelt as, so for
 * either this is a respelling, the same op re-pointing a link is.
 *
 * @example iconOp(rows, row, "BookOpen"); // { kind: "icon", path: "docs/a.mdx", icon: "BookOpen" }
 */
export function iconOp(rows: readonly Row[], row: Row, icon: string | null): StructureOp | null {
  const link = row.kind === "link" && row.token ? linkIn(row.token) : null;
  if (link) return respellOp(rows, row, linkOf({ ...link, icon }));

  const separator = row.kind === "separator" && row.token ? separatorIn(row.token) : null;
  if (separator) return respellOp(rows, row, separatorOf(separator.label, icon));

  if (isSpelt(row.kind) || row.kind === "other" || !row.path) return null;
  return { kind: "icon", path: row.path, icon };
}

/**
 * Every name a folder's order should carry, as the rows currently read it.
 *
 * Read off the rows rather than the tree because all three builders below act
 * on a folder the reader is looking at. A collapsed folder's children are not
 * in the list at all, and an order written without them would drop every link
 * and separator it could not see.
 */
function orderIn(rows: readonly Row[], folder: string) {
  return rows.filter((row) => row.token !== null && row.folder === folder).map((row) => row.token as string);
}

/**
 * The order that adds a link or a separator to the end of a folder.
 *
 * Adding, respelling and deleting either are all one `reorder` and nothing
 * else, because each is one entry in one `pages` array and there is no file to
 * write, move or delete alongside it. The order the editor sends is the whole
 * truth about that folder's links and separators, so leaving one out of it is
 * how it goes away.
 *
 * @example addEntryOp(rows, "docs", "---Guides---")
 */
export function addEntryOp(rows: readonly Row[], folder: string, entry: string): StructureOp {
  return { kind: "reorder", folder, names: [...orderIn(rows, folder), entry] };
}

/** The order that respells one entry where it already sits, or nothing when it is unchanged. */
export function respellOp(rows: readonly Row[], row: Row, entry: string): StructureOp | null {
  if (row.token === null || entry === row.token) return null;

  return {
    kind: "reorder",
    folder: row.folder,
    names: orderIn(rows, row.folder).map((name) => (name === row.token ? entry : name)),
  };
}

/** The order that leaves an entry out, which is the whole of deleting a link or a separator. */
export function removeEntryOp(rows: readonly Row[], row: Row): StructureOp | null {
  if (row.token === null) return null;

  return {
    kind: "reorder",
    folder: row.folder,
    names: orderIn(rows, row.folder).filter((name) => name !== row.token),
  };
}

/**
 * What the queue has staged for a link or separator row.
 *
 * Neither has a file, so there is no move or delete to report here: one dragged
 * somewhere else is already drawn there, and one deleted is not drawn at all.
 * What is left is whether its folder's order still spells it the way the repo
 * does, which is the mark one just added or just respelt wants.
 */
export function pendingEntry(entries: Record<string, string[]>, row: Row): Pending {
  if (!isSpelt(row.kind) || row.token === null) return null;

  return entries[row.folder]?.includes(row.token) ? null : "created";
}

/**
 * Every section a thing could be moved into, as a path and how deep it is.
 *
 * The root counts, since moving a page up to the top level is as ordinary as
 * moving it down. A section cannot be moved into itself or into its own
 * children, so those are dropped before the reader is offered them. Each one is
 * named where the queue has left it, so a page just given pages of its own is
 * offered as the folder it now is.
 */
export function destinations(
  items: readonly TreeNode[],
  docs: Record<string, DocEntry>,
  excluding: string | null,
  ops: StructureOp[] = [],
): { path: string; label: string; depth: number }[] {
  const found: { path: string; label: string; depth: number }[] = [{ path: DOCS_ROOT, label: "Top level", depth: 0 }];

  const walk = (level: readonly TreeNode[], depth: number) => {
    for (const node of level) {
      if (node.type !== "folder") continue;

      const origin = kindOf(node) === "section" ? pathOf(node, docs) : null;
      const path = origin === null ? null : stagedPath(ops, origin);
      if (path && !(excluding && `${path}/`.startsWith(`${excluding}/`))) {
        found.push({ path, label: nameOf(node), depth });
      }

      walk(node.children, depth + 1);
    }
  };

  walk(items, 1);
  return found;
}

/** The one page the editor will not let anybody move or delete. */
export function isRoot(path: string | null) {
  return path === sectionIndex(DOCS_ROOT) || path === `${DOCS_ROOT}/index.md`;
}
