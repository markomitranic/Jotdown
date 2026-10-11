"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "cn";
import { FileText, Link2, Plus, SeparatorHorizontal } from "lucide-react";
import { useTreePath } from "@jotdown/core/components/docs/tree";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";
import { useLiveEditConfig } from "../client/api";
import { linkIn, linkOf, separatorOf, type SidebarLink } from "@jotdown/core/lib/paths";
import {
  addEntryOp,
  dropOps,
  flatten,
  holderOf,
  iconOp,
  isSpelt,
  levelFolder,
  nameOf,
  newPagePath,
  pathOf,
  pendingEntry,
  pendingFor,
  projectDrop,
  refold,
  removeEntryOp,
  renameOp,
  respellOp,
  stage,
  type NewThing,
  type Row,
  type TreeNode,
} from "./queue";
import { holdsGenerated, isGeneratedPage } from "./generated";
import LinkPrompt from "./LinkPrompt";
import RenameField from "./RenameField";
import SidebarRow from "./SidebarRow";
import { useStructure } from "./useStructure";
import { GROUP_LABEL } from "@jotdown/core/components/ReadingSidebar";
import { DEPTH_STEP, ROW, RULE_AT, indentOf } from "./style";

/**
 * A row that exists only as an empty name field, waiting to be told what it is.
 *
 * `under` is the row it is drawn beneath, and `nest` the page that becomes a
 * folder for it once it is named, when it goes inside a page holding nothing yet.
 */
type Draft = { folder: string; under: string; kind: NewThing; nest?: string };

/**
 * A link the form is open on: one already in a folder, or a new one going into it.
 *
 * Held here rather than on the row, so the dialog is one thing on the page
 * instead of one per row, and so a link being written survives the row under it
 * being redrawn by somebody else's staged change.
 */
type LinkDraft = { folder: string; row: Row | null; nest?: string };

/**
 * The row being dragged, and the section to open again once it is put down.
 *
 * A section shuts when it is picked up, so its pages travel with it instead of
 * being rows the drag has to cross and could be dropped between.
 */
type Carrying = { id: string; reopen: string | null };

/**
 * Every folder that was open the last time the sidebar was drawn, during this visit.
 *
 * Kept outside the component because the sidebar is drawn afresh once a save
 * lands, and a folder that shut itself then would hide the very page the
 * reader just put in it.
 */
const unfolded = new Set<string>();

/** How long a pointer rests on a shut section mid-drag before it opens. */
const OPEN_AFTER_MS = 600;

/** How a new thing of each kind is drawn and described while it is being named. */
const NEW_THINGS = {
  page: { icon: FileText, title: "Page", name: "New page", hint: "A document, written in the browser" },
  separator: {
    icon: SeparatorHorizontal,
    title: "Separator",
    name: "New separator",
    hint: "A heading over the pages below it",
  },
} satisfies Record<NewThing, { icon: typeof FileText; title: string; name: string; hint: string }>;

/**
 * The sidebar, drawn as something you can rearrange.
 *
 * In the studio this replaces the page tree the sidebar draws rather than
 * decorating it, and draws every row at the height and indent the reading tree
 * gives it, so swapping one for the other moves nothing on screen. Sections
 * open as the reader navigates into them, the way the reading tree's do.
 *
 * It is one flat list rather than nested folders, and that is the whole reason
 * dragging works: a page dragged from one section into another crosses rows at
 * different levels, and a drag can only reorder within one list. Nesting is a
 * left pad. Where a row lands is `projectDrop` in `queue.ts`: up and down picks
 * the gap, left and right picks how deep in it, and the dashed slot shows the
 * answer while the pointer is still moving. A section rested on mid-drag opens,
 * so a page can be taken anywhere in the tree in one gesture.
 *
 * The tree arrives as a prop rather than being read from context, so the list
 * this draws is the staged one: a page moved but not yet saved is drawn under
 * the section it is headed for. Rows stay clickable, because deciding where a
 * page belongs usually means reading it first, and the queue survives the
 * navigation.
 */
export default function ArrangeTree({ tree }: { tree: readonly TreeNode[] }) {
  const { docs, entries } = useLiveEditConfig();
  const structure = useStructure();
  const trail = useTreePath();
  const ops = structure?.ops ?? [];
  const drawn = structure?.drawn ?? [];

  const rebuilt = useMemo(() => refold(tree, docs), [docs, tree]);
  const root = useMemo(() => levelFolder(rebuilt, docs), [docs, rebuilt]);

  const [closed, setClosed] = useState(() => shutIn(rebuilt, docs, trail));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [carrying, setCarrying] = useState<Carrying | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const staged = stage(rebuilt, drawn, docs, root);
  const rows = flatten(staged, docs, entries, drawn, closed, root);

  const from = carrying ? rows.findIndex((row) => row.id === carrying.id) : -1;
  const to = overId ? rows.findIndex((row) => row.id === overId) : -1;
  const drop = from !== -1 && to !== -1 ? projectDrop(rows, from, to, offset, DEPTH_STEP, root) : null;
  const locked =
    drop !== null && (holdsGenerated(docs, drop.folder) || (!!drop.nest && isGeneratedPage(docs, drop.nest)));
  const lifted = from === -1 ? null : rows[from];
  const resting = to === -1 || to === from ? null : rows[to];
  const opening = resting?.kind === "section" && !resting.open ? resting.path : null;

  useEffect(() => {
    const here = trailPaths(trail, docs);

    setClosed((was) => {
      const next = new Set([...was].filter((folder) => !holdsAny(folder, here)));
      return next.size === was.size ? was : next;
    });
  }, [docs, trail]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: open only calls a state setter, and the timer restarts when the hovered folder changes, not on every render
  useEffect(() => {
    if (!opening) return;

    const timer = setTimeout(() => open(opening), OPEN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [opening]);

  useEffect(() => {
    for (const row of rows) {
      if (row.kind !== "section" || !row.path) continue;

      if (row.open) unfolded.add(row.path);
      else unfolded.delete(row.path);
    }
  });

  const toggle = (path: string) =>
    setClosed((was) => {
      const next = new Set(was);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  /**
   * Opens a folder, so a row staged into it has somewhere to be drawn.
   *
   * Every section but the one you are reading arrives shut, and the flat list is
   * built by leaving a shut folder's contents out of it. Staging a page into one
   * without opening it first stages a row nothing can draw, which reads as the
   * page having been dropped.
   */
  const open = (folder: string) => {
    setClosed((was) => {
      const next = new Set(was);
      next.delete(folder);
      return next;
    });

    return folder;
  };

  const startDraft = (row: Row) => (kind: NewThing) => {
    setDraft({ ...inside(row), kind });
  };

  const startLink = (row: Row) => {
    if (row.kind === "link") return setLinkDraft({ folder: row.folder, row });

    const { folder, nest } = inside(row);
    setLinkDraft({ folder, row: null, nest });
  };

  /**
   * Where something added inside a row goes, opening it first.
   *
   * A section already is its folder. A page is not yet, so it is named as the
   * folder it would become, and becomes it only when the new thing is saved
   * into the queue: dismissing the name field leaves the page as it was.
   */
  const inside = (row: Row) => {
    if (row.kind === "page" && row.path) {
      return { folder: holderOf(row.path), under: row.path, nest: row.path };
    }

    const folder = open(row.path ?? row.folder);
    return { folder, under: folder };
  };

  /** Queues the page becoming a folder, when the thing just named is the first inside it. */
  const nestFor = (nest: string | undefined) => {
    if (nest) structure?.queue({ kind: "nest", path: nest });
  };

  const started = ({ active }: DragStartEvent) => {
    const row = rows.find((entry) => entry.id === active.id);
    const reopen = row?.kind === "section" && row.open ? row.path : null;

    if (reopen) setClosed((was) => new Set(was).add(reopen));
    setCarrying({ id: String(active.id), reopen });
    setOverId(String(active.id));
    setOffset(0);
  };

  const settle = () => {
    if (carrying?.reopen) open(carrying.reopen);
    setCarrying(null);
    setOverId(null);
    setOffset(0);
  };

  const ended = ({ over }: DragEndEvent) => {
    if (over && drop && !locked && from !== -1 && to !== -1) {
      for (const op of dropOps(rows, from, to, drop.folder, drop.nest)) structure?.queue(op);
      if (drop.folder !== root) open(drop.folder);
    }

    settle();
  };

  const rename = (row: Row) => (name: string) => {
    const op = renameOp(rows, row, name);
    if (op) structure?.queue(op);
    setRenaming(null);
  };

  const reicon = (row: Row) => (icon: string | null) => {
    const op = iconOp(rows, row, icon);
    if (op) structure?.queue(op);
  };

  /**
   * Writes a link into its folder's order, whether it is new or being changed.
   *
   * Both are the same op, because a link is one entry in one order and nothing
   * else. The rows are the order, so this has to run against the list the
   * reader is looking at rather than against the tree it was built from.
   */
  const saveLink = (link: SidebarLink) => {
    if (!linkDraft) return;

    const op = linkDraft.row
      ? respellOp(rows, linkDraft.row, linkOf(link))
      : addEntryOp(rows, linkDraft.folder, linkOf(link));

    if (op) nestFor(linkDraft.nest);
    if (op) structure?.queue(op);
    setLinkDraft(null);
  };

  const removeEntry = (row: Row) => {
    const op = removeEntryOp(rows, row);
    if (op) structure?.queue(op);
  };

  /**
   * Stages a new page or separator, drawn with an icon from the start.
   *
   * A page gets the icon it was drawn with while it was being named, so it
   * lines up with its neighbours rather than sitting one icon's width to the
   * left of them. A separator is a label, and labels carry none. It lands at the
   * end of its folder, heading nothing until pages are dragged under it.
   */
  const create = (name: string) => {
    if (!draft) return;

    nestFor(draft.nest);

    if (draft.kind === "page") {
      structure?.queue({
        kind: "create",
        path: newPagePath(draft.folder, name),
        title: name,
        description: null,
        icon: "FileText",
      });
    }

    if (draft.kind === "separator") {
      structure?.queue(addEntryOp(rows, draft.folder, separatorOf(name)));
    }

    setDraft(null);
  };

  const draftAfter = draft ? lastIn(rows, draft.under) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{ canScroll: (element) => element.closest("#jd-sidebar") !== null }}
      onDragStart={started}
      onDragMove={({ delta }) => setOffset(delta.x)}
      onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
      onDragEnd={ended}
      onDragCancel={settle}
    >
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-0.5">
          {rows.flatMap((row, index) => [
            <SidebarRow
              key={row.id}
              row={row}
              tree={staged}
              pending={isSpelt(row.kind) ? pendingEntry(entries, row) : pendingFor(ops, row.origin)}
              renaming={renaming === row.id}
              slot={row.id === carrying?.id ? drop?.depth : undefined}
              locked={locked}
              expanded={row.open}
              target={drop !== null && !locked && drop.folder !== root && row.path === (drop.nest ?? drop.folder)}
              onRename={rename(row)}
              onStartRenaming={() => setRenaming(row.id)}
              onStopRenaming={() => setRenaming(null)}
              onToggle={() => row.path && toggle(row.path)}
              onDraft={startDraft(row)}
              onDraftLink={() => startLink(row)}
              onRemoveEntry={() => removeEntry(row)}
              onIcon={reicon(row)}
            />,
            ...(index === draftAfter && draft
              ? [
                  <DraftRow
                    key="live-edit-draft"
                    depth={depthOf(rows, draft.under)}
                    kind={draft.kind}
                    onConfirm={create}
                    onCancel={() => setDraft(null)}
                  />,
                ]
              : []),
          ])}

          {draft && draftAfter === -1 && (
            <DraftRow depth={0} kind={draft.kind} onConfirm={create} onCancel={() => setDraft(null)} />
          )}

          <li className="mt-1">
            <AddMenu
              onDraft={(kind) => setDraft({ folder: root, under: root, kind })}
              onDraftLink={() => setLinkDraft({ folder: root, row: null })}
            />
          </li>
        </ul>
      </SortableContext>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {lifted && <Lifted row={lifted} />}
        </DragOverlay>,
        document.body,
      )}

      {linkDraft && (
        <LinkPrompt
          heading={linkDraft.row ? `Edit ${nameOf(linkDraft.row.node)}` : "New link"}
          link={linkDraft.row?.token ? linkIn(linkDraft.row.token) : null}
          confirmLabel={linkDraft.row ? "Save" : "Add"}
          onConfirm={saveLink}
          onCancel={() => setLinkDraft(null)}
        />
      )}
    </DndContext>
  );
}

/**
 * The row under the pointer while it is carried, lifted off the list.
 *
 * Only the icon and the name, on a card, because the controls and the rule
 * belong to the row's place in the list and not to the thing being moved.
 */
function Lifted({ row }: { row: Row }) {
  return (
    <div className="flex w-fit max-w-64 cursor-grabbing items-center gap-2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-popover-foreground text-sm shadow-lg ring-1 ring-primary/20 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
      {row.node.icon}
      <span className="truncate">{nameOf(row.node)}</span>
    </div>
  );
}

/** The empty row a new page starts life as, already asking for its name. */
function DraftRow({
  depth,
  kind,
  onConfirm,
  onCancel,
}: {
  depth: number;
  kind: NewThing;
  onConfirm(name: string): void;
  onCancel(): void;
}) {
  const { icon: Icon, name } = NEW_THINGS[kind];

  return (
    <li>
      <div
        className={cn(ROW, "text-foreground", kind === "separator" && GROUP_LABEL)}
        style={{ paddingInlineStart: indentOf(depth) }}
      >
        {depth > 0 && (
          <span
            className="absolute inset-y-1 w-px bg-border"
            style={{ insetInlineStart: RULE_AT }}
            aria-hidden="true"
          />
        )}
        <Icon className="text-muted-foreground" aria-hidden="true" />
        <RenameField value="" placeholder={name} onConfirm={onConfirm} onCancel={onCancel} />
      </div>
    </li>
  );
}

/**
 * The last row of the list, which adds something to the top level.
 *
 * A row rather than a set of buttons, so it reads as part of the list it adds
 * to, and a menu rather than one button, because a page, a separator and a link
 * are three different things to make.
 */
function AddMenu({ onDraft, onDraftLink }: { onDraft(kind: NewThing): void; onDraftLink(): void }) {
  const kinds: NewThing[] = ["page", "separator"];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(ROW, "w-full cursor-pointer text-muted-foreground/80 data-[state=open]:bg-accent/50")}
        >
          <Plus />
          Add to the sidebar
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" onCloseAutoFocus={(event) => event.preventDefault()}>
        {kinds.map((kind) => {
          const { icon: Icon, title, hint } = NEW_THINGS[kind];

          return (
            <DropdownMenuItem key={kind} className="items-start py-1.5" onSelect={() => onDraft(kind)}>
              <Icon className="mt-0.5 text-muted-foreground" />
              <span className="flex flex-col">
                {title}
                <span className="text-muted-foreground text-xs">{hint}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem className="items-start py-1.5" onSelect={onDraftLink}>
          <Link2 className="mt-0.5 text-muted-foreground" />
          <span className="flex flex-col">
            Link
            <span className="text-muted-foreground text-xs">A row pointing somewhere else</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The last row that sits anywhere under a row, which is where a new one inside it goes.
 *
 * Anywhere under, not directly inside: a new page in a section with sub-sections
 * belongs after them rather than in the middle of the list.
 */
function lastIn(rows: readonly Row[], folder: string) {
  let end = rows.findIndex((row) => row.path === folder);

  for (const row of rows.slice(end + 1)) {
    if (!`${row.folder}/`.startsWith(`${folder}/`)) break;
    end += 1;
  }

  return end;
}

/** How far in a new row inside this row should sit. */
function depthOf(rows: readonly Row[], folder: string) {
  return (rows.find((row) => row.path === folder)?.depth ?? -1) + 1;
}

/**
 * Every section except the ones the page you are reading sits inside.
 *
 * The page tree carries no per-folder collapsed state, so the reading sidebar
 * works it out from the active page and `defaultOpen`, and this does the same:
 * the trail you can see stays open, a folder marked open or left open earlier
 * this visit stays open, and everything else arrives shut, so nothing springs open or shut when the tree
 * is taken. Collapse is one set here rather than a flag per row, because the
 * flat list is built by leaving shut folders' contents out of it.
 *
 * A folder is judged by whether the trail runs through it rather than by whether
 * the trail names it, because an extracted folder is not in the trail at all:
 * the page tree threw it away when it drew the children in the parent's list,
 * so the only thing that says it holds the page you are reading is that page's
 * own path sitting under it.
 */
function shutIn(
  tree: readonly TreeNode[],
  docs: ReturnType<typeof useLiveEditConfig>["docs"],
  trail: readonly TreeNode[],
) {
  const here = trailPaths(trail, docs);
  const shut = new Set<string>();

  const walk = (level: readonly TreeNode[]) => {
    for (const node of level) {
      if (node.type !== "folder") continue;

      const path = pathOf(node, docs);

      if (path && !node.defaultOpen && !holdsAny(path, here) && !unfolded.has(path)) shut.add(path);
      walk(node.children);
    }
  };

  walk(tree);
  return shut;
}

/** The file paths of every node on the trail to the page being read. */
function trailPaths(trail: readonly TreeNode[], docs: ReturnType<typeof useLiveEditConfig>["docs"]) {
  return trail.flatMap((node) => pathOf(node, docs) ?? []);
}

/**
 * Whether a folder sits over any of these paths.
 *
 * @example holdsAny("docs/a", ["docs/a/b.mdx"]); // true
 */
function holdsAny(folder: string, paths: readonly string[]) {
  return paths.some((at) => `${at}/`.startsWith(`${folder}/`));
}
