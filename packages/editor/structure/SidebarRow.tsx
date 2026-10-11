"use client";

import { isValidElement, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "cn";
import { ChevronRight, FileText, Files, GripVertical, Smile } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLiveEditConfig } from "../client/api";
import { useUnsaved } from "../inplace/unsaved";
import IconPicker, { dynamicName, UnknownIcon } from "../editor/IconPicker";
import { linkIn, separatorIn } from "@jotdown/core/lib/paths";
import { containsGenerated, isGeneratedPage } from "./generated";
import { isRoot, isSpelt, nameOf, type NewThing, type Pending, type Row, type RowKind, type TreeNode } from "./queue";
import RenameField from "./RenameField";
import RowControls from "./RowControls";
import { GROUP_LABEL } from "@jotdown/core/components/ReadingSidebar";
import { useOptimisticPathname } from "@jotdown/core/components/OptimisticPathname";
import { SiteLink } from "@jotdown/core/components/SiteLink";
import { HERE, ROW, RULE_AT, indentOf } from "./style";

/** What the icon picker on each kind of row is called. */
const ICON_LABEL: Record<RowKind, string> = {
  page: "Page icon",
  section: "Section icon",
  link: "Link icon",
  separator: "Separator icon",
  other: "Page icon",
};

/** What the dot beside a row with a staged change says when you hover it. */
const PENDING: Record<Exclude<Pending, null>, string> = {
  created: "New, not saved yet",
  moved: "Moved, not saved yet",
  renamed: "Renamed, not saved yet",
  url: "New address, not saved yet",
  icon: "New icon, not saved yet",
  open: "Opens differently, not saved yet",
  deleted: "Deleted, not saved yet",
};

type Props = {
  row: Row;
  /** The staged tree, which is where `Move to…` reads the sections from. */
  tree: readonly TreeNode[];
  pending: Pending;
  renaming: boolean;
  /** Whether what is inside it is showing. */
  expanded: boolean;
  /** Set on the row being dragged: the depth of the gap it would land in. */
  slot?: number;
  /** Set when that gap is inside generated pages, where nothing may be dropped. */
  locked: boolean;
  /** Set on the folder a dragged row would land inside. */
  target: boolean;
  onRename(name: string): void;
  onStopRenaming(): void;
  onStartRenaming(): void;
  onToggle(): void;
  onDraft(kind: NewThing): void;
  /** Opens the link form on this row, or on a new link inside it. */
  onDraftLink(): void;
  /** Takes a link or a separator out of its folder's order. */
  onRemoveEntry(): void;
  onIcon(icon: string | null): void;
};

/**
 * One row of the arrangeable sidebar, and the thing you drag.
 *
 * The whole row is the handle, as it is in Notion or Linear: press anywhere
 * and move a few pixels. A click that never moves is still a click, so a label
 * still opens its page and a chevron still folds its section. The grip that
 * appears in the gutter left of the row on hover, at every depth, says the row
 * can move, and is what a keyboard picks it up by.
 *
 * Nesting is a left pad rather than a nested list, because the whole tree is one
 * flat sortable list: a page dragged from one section into another has to cross
 * rows that belong to different levels, and dnd-kit can only reorder within one
 * list. The rule down the left of an indented row stands in for the one the
 * reading sidebar draws down a folder's contents.
 *
 * While it is being dragged the row stays in the list as a dashed slot, drawn
 * at the depth it would land at, so the gap you are aiming at is always the
 * gap you get.
 *
 * Only a row with pages inside has a chevron, at its end where the reading
 * sidebar draws it, and it stays put while the pointer is on the row. A page
 * with nothing inside has none, so an empty page and a full one never look
 * alike. One that holds pages and has no icon of its own is drawn as a stack.
 */
export default function SidebarRow({
  row,
  tree,
  pending,
  renaming,
  expanded,
  slot,
  locked,
  target,
  onRename,
  onStopRenaming,
  onStartRenaming,
  onToggle,
  onDraft,
  onDraftLink,
  onRemoveEntry,
  onIcon,
}: Props) {
  const { path, node, kind } = row;
  const pathname = useOptimisticPathname();
  const unsaved = useUnsaved();
  const { docs, icons } = useLiveEditConfig();
  const [picking, setPicking] = useState(false);

  const link = kind === "link";
  const generated = path !== null && containsGenerated(docs, path);
  const draggable = row.token !== null && !isRoot(path) && !generated && !renaming;

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: row.id,
    disabled: !draggable,
  });

  const label = nameOf(node) || textOf(node.name);
  const separator = kind === "separator";
  const folder = kind === "section";
  const filled = folder && node.type === "folder" && node.children.length > 0;
  const nameable = row.token !== null && !link && (separator || (path !== null && !isGeneratedPage(docs, path)));
  const href = node.type === "page" ? node.url : node.type === "folder" ? node.index?.url : undefined;
  const icon = node.liveIcon === undefined ? writtenIcon(row, icons) : node.liveIcon;
  const glyph = glyphOf(node, icon, isSpelt(kind)) ?? fallbackGlyph(kind, path, filled);
  const controlled = !renaming && (isSpelt(kind) ? row.token !== null : path !== null && kind !== "other");

  return (
    <li
      ref={setNodeRef}
      className={cn("relative", separator && "mt-5 first:mt-0")}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div
        className={cn(
          ROW,
          "select-none",
          separator && `${GROUP_LABEL} pt-1 pb-1.5`,
          href && trimmed(href) === trimmed(pathname) && HERE,
          target && "bg-primary/5 text-primary ring-1 ring-primary/30",
          slot !== undefined && "invisible",
        )}
        style={{ paddingInlineStart: indentOf(row.depth) }}
        {...(draggable ? listeners : {})}
      >
        {row.depth > 0 && (
          <span
            className="absolute inset-y-1 w-px bg-border"
            style={{ insetInlineStart: RULE_AT }}
            aria-hidden="true"
          />
        )}

        {draggable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="absolute inset-y-0 -start-4 my-auto flex h-5 w-4 cursor-grab items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-opacity focus-visible:opacity-100 active:cursor-grabbing group-hover/row:opacity-100 [&_svg]:size-3.5"
            aria-label={`Drag ${label}`}
            {...attributes}
          >
            <GripVertical />
          </button>
        )}

        {(glyph || picking) && (
          <span className="flex size-4 shrink-0 items-center" onPointerDown={(event) => event.stopPropagation()}>
            <IconPicker
              value={icon}
              readOnly={generated}
              label={ICON_LABEL[kind]}
              open={picking || undefined}
              onOpenChange={(open) => !open && setPicking(false)}
              onChange={onIcon}
              className={cn(
                "-m-0.5 size-5 rounded-md p-0 text-current hover:bg-accent hover:text-accent-foreground disabled:opacity-100 [&_svg]:size-4",
                glyph && "border-0",
              )}
            >
              {glyph ?? <Smile />}
            </IconPicker>
          </span>
        )}

        {renaming ? (
          <RenameField value={label} onConfirm={onRename} onCancel={onStopRenaming} />
        ) : (
          <Label
            href={href}
            link={link}
            struck={pending === "deleted"}
            onOpen={folder && !href ? onToggle : undefined}
            onRename={nameable ? onStartRenaming : undefined}
          >
            {node.name}
          </Label>
        )}

        {pending && !renaming && (
          <span
            className={cn("size-1.5 shrink-0 rounded-full", pending === "deleted" ? "bg-destructive" : "bg-primary")}
            role="img"
            title={PENDING[pending]}
            aria-label={PENDING[pending]}
          />
        )}

        {!pending && href && unsaved.has(href) && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-primary"
            title="This page has changes waiting in this browser"
          />
        )}

        {filled && (
          <button
            type="button"
            className="-m-0.5 ms-auto flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={expanded}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggle}
          >
            <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
        )}

        {controlled && (
          <RowControls
            className={filled ? "end-7" : undefined}
            row={row}
            label={label}
            tree={tree}
            onRename={onStartRenaming}
            onDraft={onDraft}
            onDraftLink={onDraftLink}
            onPickIcon={() => setPicking(true)}
            onRemoveEntry={onRemoveEntry}
          />
        )}
      </div>

      {slot !== undefined && <DropSlot depth={slot} locked={locked} />}
    </li>
  );
}

/**
 * The Lucide name a row's files give it, before the queue has had a say.
 *
 * A link or a separator spells its icon inside its own entry; a page or a
 * section has it read off its files by the server.
 *
 * @example writtenIcon(row, icons); // "BookOpen"
 */
function writtenIcon(row: Row, icons: Record<string, string>) {
  if (row.kind === "link") return linkIn(row.token ?? "")?.icon ?? null;
  if (row.kind === "separator") return separatorIn(row.token ?? "")?.icon ?? null;

  return row.path ? (icons[row.path] ?? null) : null;
}

/**
 * The icon a page or a section is drawn with when nothing gave it one: a stack when it holds pages.
 *
 * @example fallbackGlyph("section", "docs/guides", true); // <Files />
 */
function fallbackGlyph(kind: RowKind, path: string | null, filled: boolean) {
  if (filled) return <Files />;
  if (kind === "section" || (kind === "page" && !isRoot(path))) return <FileText />;

  return null;
}

/**
 * The icon a row is drawn with: the one the queue chose, or the one the server drew.
 *
 * The server's element is used whenever the queue has not touched the icon, so
 * an untouched row never waits on `DynamicIcon` fetching its module. A name
 * Lucide does not have is drawn as a warning, so it is fixed rather than lost.
 */
function glyphOf(node: TreeNode, icon: string | null, spelt: boolean): ReactNode {
  const name = dynamicName(icon);

  if (icon && !name) return <UnknownIcon />;
  if (node.liveIcon !== undefined || (spelt && !node.icon)) {
    return name ? <DynamicIcon name={name} /> : null;
  }

  return node.icon ?? null;
}

/**
 * The words in a row's name, which a generated page draws as its title beside a method badge.
 *
 * @example textOf(<>Get timeslots <span>GET</span></>); // "Get timeslots GET"
 */
function textOf(name: ReactNode): string {
  if (typeof name === "string" || typeof name === "number") return String(name);
  if (Array.isArray(name)) return name.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(name)) return textOf(name.props.children);

  return "";
}

/** One URL as the other spells it, since only one of the two ever carries a trailing slash. */
function trimmed(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * A row's name: a link to its page, or plain text for a row with nowhere to go.
 *
 * Double-clicking it renames the row. A folder with no page of its own opens and
 * shuts on a click instead, the way it does in the reading sidebar.
 */
function Label({
  href,
  link,
  struck,
  onOpen,
  onRename,
  children,
}: {
  href: string | undefined;
  link: boolean;
  struck: boolean;
  onOpen?(): void;
  onRename?(): void;
  children: ReactNode;
}) {
  const className = cn("min-w-0 flex-1", struck && "line-through opacity-60");

  const rename = (event: MouseEvent) => {
    if (!onRename) return;
    event.preventDefault();
    onRename();
  };

  if (href) {
    return (
      <SiteLink
        className={className}
        href={href}
        draggable={false}
        target={link ? "_blank" : undefined}
        rel={link ? "noreferrer" : undefined}
        onDoubleClick={rename}
      >
        {children}
      </SiteLink>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut, the row's chevron button opens and shuts it from the keyboard
    // biome-ignore lint/a11y/useKeyWithClickEvents: a pointer shortcut, the row's chevron button opens and shuts it from the keyboard
    <span className={cn(className, onOpen && "cursor-pointer")} onClick={onOpen} onDoubleClick={rename}>
      {children}
    </span>
  );
}

/**
 * Where the row being dragged would land, drawn at the depth it would land at.
 *
 * Red when the gap is inside generated pages, where letting go puts it back.
 */
function DropSlot({ depth, locked }: { depth: number; locked: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-y-0.5 end-0 rounded-lg border border-dashed transition-[inset-inline-start] duration-100",
        locked ? "border-destructive/60 bg-destructive/5" : "border-primary/60 bg-primary/5",
      )}
      style={{ insetInlineStart: indentOf(depth) - 6 }}
      aria-hidden="true"
    />
  );
}
