"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Check,
  ChevronsUpDown,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import { DOCS_ROOT, dirOf, docUrl, isSectionIndex } from "@jotdown/core/lib/paths";
import { SHORTCUTS, ShortcutHint, useModifier, useShortcut } from "@jotdown/core/components/shortcuts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { LiveEditFailure, saveStructure } from "@jotdown/editor/client/api";
import { mayLeave } from "@jotdown/editor/client/useLeaveGuard";
import { isRoot, newPagePath } from "@jotdown/editor/structure/queue";
import { PageDeletion } from "@jotdown/editor/structure/usePageDeletion";
import type { StructureOp } from "@jotdown/editor/types";
import type { PageOutline } from "@/lib/page-outline";
import { Key, Note } from "../PaletteParts";
import { ITEM } from "./note";

/** One line of the picker: a page, or a folder that may open at its own page. */
type Row = {
  key: string;
  title: string;
  url: string | null;
  path: string | null;
  depth: number;
  trail: string;
  folder: boolean;
};

/** Where a page made from the picker lands, and the folders that place is in, for the row offering it. */
type Place = { folder: string; trail: string };

type Props = {
  project: { id: string; base: string };
  editor: { name: string; email: string };
};

/** How far each level of the tree steps in, in pixels. */
const INDENT = 16;

/** The key of the row that makes a page out of what is typed. */
const NEW = "\0new";

/**
 * The page on screen, and a picker that goes to any other, makes one or deletes one, wherever the project is drawn.
 *
 * It sits in the status strip beside the branch, because a project's own
 * layout can hide the sidebar or leave it out, and the studio still has to
 * reach every page. ⌘ P opens it from anywhere, a site's canvas included. The
 * pages are read again each time it opens, so one added a moment ago is there.
 * A page made here lands beside the page on screen, or inside it when it is a
 * folder's own page, and is committed and opened at once.
 *
 * @example <PagePicker project={{ id: "abc123", base: "/you/notes" }} editor={editor} />
 */
export function PagePicker({ project, editor }: Props) {
  const [open, setOpen] = useState(false);
  const [doomed, setDoomed] = useState<Row | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pages = useQuery({
    queryKey: ["studio", "pages", project.id],
    queryFn: () =>
      fetchJson<{ pages: PageOutline[] }>(`/api/projects/${project.id}/pages`, { cache: "no-store" }).then(
        (answer) => answer.pages,
      ),
    staleTime: 60_000,
    retry: false,
  });

  const commit = (op: StructureOp) =>
    saveStructure(`/api/projects/${project.id}/live-edit`, { ops: [op], author: editor });

  const create = useMutation({
    mutationFn: async (title: string) => {
      const path = newPagePath(place.folder, title);
      await commit({ kind: "create", path, title, description: null, icon: "FileText" });
      return path;
    },
    onSuccess: (path) => {
      setOpen(false);
      router.refresh();
      router.push(docUrl(path, project.base));
    },
  });

  const remove = useMutation({
    mutationFn: (row: Row) => commit({ kind: "delete", path: row.path ?? "" }),
    onSuccess: (_, row) => {
      router.refresh();
      if (row.path === here?.path) router.push(project.base || "/");
      void pages.refetch();
    },
  });

  const rows = rowsOf(pages.data ?? []);
  const here = rows.find((row) => row.url !== null && samePage(row.url, pathname));
  const place = placeBeside(here);
  const failure = create.error ?? remove.error;

  function show(next: boolean) {
    setOpen(next);
    if (!next) return;
    create.reset();
    remove.reset();
    void pages.refetch();
  }

  function go(url: string) {
    setOpen(false);
    if (here?.url !== url) void mayLeave().then((yes) => yes && router.push(url));
  }

  async function make(title: string) {
    if (create.isPending || !(await mayLeave())) return;
    create.mutate(title);
  }

  useShortcut(SHORTCUTS.pages, () => show(!open));

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => show(true)}
            className={cn(ITEM, "min-w-0 aria-expanded:bg-accent")}
          >
            <FileText className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-48 truncate">{here?.title ?? "Pages"}</span>
            <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <ShortcutHint label="Go to a page" chords={SHORTCUTS.pages} />
        </TooltipContent>
      </Tooltip>
      <PagePalette
        open={open}
        onOpenChange={show}
        rows={rows}
        loading={pages.isPending}
        error={pages.error?.message ?? (failure ? reasonOf(failure) : "")}
        current={here?.url ?? null}
        place={place}
        creating={create.isPending ? create.variables : null}
        deleting={remove.isPending ? (remove.variables.path ?? null) : null}
        onChoose={go}
        onCreate={(title) => void make(title)}
        onDelete={setDoomed}
      />
      <PageDeletion
        page={doomed?.path ? { path: doomed.path, title: doomed.title } : null}
        onCancel={() => setDoomed(null)}
        onDelete={() => doomed && remove.mutate(doomed)}
      />
    </>
  );
}

type PaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row[];
  loading: boolean;
  error: string;
  current: string | null;
  place: Place;
  /** The title of the page being made, while it is. */
  creating: string | null;
  /** The file of the page being deleted, while it is. */
  deleting: string | null;
  onChoose: (url: string) => void;
  onCreate: (title: string) => void;
  onDelete: (row: Row) => void;
};

/**
 * Every page as a tree, or the pages whose title or folder matches what is typed, as a flat list.
 *
 * It opens on the page on screen, even when the pages arrive after it does. A folder with no page of its own is a label
 * the arrow keys pass over. Typing lists only pages, each with the folders it
 * sits in, and every word typed has to match its title or one of those folders.
 * Under the matches waits a row that makes a page titled with what is typed.
 */
function PagePalette({
  open,
  onOpenChange,
  rows,
  loading,
  error,
  current,
  place,
  creating,
  deleting,
  onChoose,
  onCreate,
  onDelete,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const modifier = useModifier();

  const title = query.trim();
  const typed = title.toLowerCase();
  const words = typed.split(/\s+/);
  const shown = typed
    ? rows.filter(
        (row) => row.url !== null && words.every((word) => `${row.trail} ${row.title}`.toLowerCase().includes(word)),
      )
    : rows;
  const choosable = shown.filter((row) => row.url !== null);
  const keys = [...choosable.map((row) => row.key), ...(typed ? [NEW] : [])];
  const chosenKey =
    keys.find((key) => key === picked) ??
    (typed ? undefined : choosable.find((row) => row.url === current)?.key) ??
    keys[0];
  const chosen = choosable.find((row) => row.key === chosenKey);
  const deletable = chosen && canDelete(chosen) ? chosen : null;

  const reset = useEffectEvent(() => {
    setQuery("");
    setPicked(null);
  });

  useEffect(() => {
    if (open) reset();
  }, [open]);

  useEffect(() => {
    list.current?.querySelector(`[data-row="${chosenKey}"]`)?.scrollIntoView({ block: "nearest" });
  }, [chosenKey]);

  function steer(event: KeyboardEvent) {
    const held = event.metaKey || event.ctrlKey;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const at = chosenKey ? keys.indexOf(chosenKey) : -1;
      setPicked(keys[(at + step + keys.length) % Math.max(keys.length, 1)] ?? null);
    }

    if (event.key === "Enter" && (held || chosenKey === NEW) && title) {
      event.preventDefault();
      onCreate(title);
    } else if (event.key === "Enter" && chosen?.url) {
      event.preventDefault();
      onChoose(chosen.url);
    }

    if (event.key === "Backspace" && held && event.shiftKey && deletable) {
      event.preventDefault();
      onDelete(deletable);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground text-sm shadow-2xl outline-none ring-1 ring-foreground/10 data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <DialogPrimitive.Title className="sr-only">Go to a page</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center gap-3 border-border border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the picker is a dialog opened to type in
              autoFocus
              value={query}
              readOnly={creating !== null}
              onChange={(event) => {
                setQuery(event.target.value);
                setPicked(null);
              }}
              onKeyDown={steer}
              placeholder="Search or make a page"
              aria-label="Search pages"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div ref={list} role="listbox" aria-label="Pages" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading && <Note>Loading the pages…</Note>}
            {error && <Note alert>{error}</Note>}
            {!loading && !typed && shown.length === 0 && <Note>No pages yet. Type a title to make the first.</Note>}
            {shown.map((row) => (
              <PageRow
                key={row.key}
                row={row}
                flat={Boolean(typed)}
                active={row.key === chosenKey}
                current={row.url !== null && row.url === current}
                deleting={row.path !== null && row.path === deleting}
                onHover={() => row.url !== null && setPicked(row.key)}
                onChoose={() => row.url && onChoose(row.url)}
                onDelete={canDelete(row) ? () => onDelete(row) : undefined}
              />
            ))}
            {typed && (
              <NewPageRow
                title={title}
                place={place}
                active={chosenKey === NEW}
                creating={creating !== null}
                onHover={() => setPicked(NEW)}
                onCreate={() => onCreate(title)}
              />
            )}
          </div>

          <p className="flex shrink-0 items-center gap-4 border-border border-t bg-secondary/50 px-4 py-2 text-muted-foreground text-xs">
            <span>
              <Key>↑</Key> <Key>↓</Key> Navigate
            </span>
            <span>
              <Key>Enter</Key> {chosenKey === NEW ? "Make" : "Open"}
            </span>
            {typed && chosenKey !== NEW && (
              <span>
                <Key>{modifier}</Key> <Key>Enter</Key> Make
              </span>
            )}
            {deletable && (
              <span>
                <Key>{modifier}</Key> <Key>⇧</Key> <Key>⌫</Key> Delete
              </span>
            )}
            <span className="ms-auto">
              <Key>Esc</Key> Close
            </span>
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type RowProps = {
  row: Row;
  flat: boolean;
  active: boolean;
  current: boolean;
  deleting: boolean;
  onHover: () => void;
  onChoose: () => void;
  /** Asks to delete the page, where it may be. */
  onDelete?: () => void;
};

/**
 * One page or folder, stepped in by its depth with a guide line for each level above it, or flat with its folders after it.
 *
 * The highlighted page shows a bin at its end, which asks before anything is deleted.
 */
function PageRow({ row, flat, active, current, deleting, onHover, onChoose, onDelete }: RowProps) {
  const depth = flat ? 0 : row.depth;
  const Icon = !row.folder ? FileText : row.url ? FolderOpen : Folder;

  if (row.url === null)
    return (
      <div
        className="relative flex h-8 items-center gap-2.5 pe-2.5 text-muted-foreground"
        style={{ paddingInlineStart: 10 + depth * INDENT }}
      >
        <Guides depth={depth} />
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate font-medium text-xs">{row.title}</span>
      </div>
    );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: an option of the listbox the focused search field steers by arrow keys and Enter
    <div
      role="option"
      aria-selected={active}
      aria-current={current ? "page" : undefined}
      aria-busy={deleting || undefined}
      data-row={row.key}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        "relative flex h-8 cursor-default items-center gap-2.5 rounded-md pe-1",
        active && "bg-accent text-accent-foreground",
        deleting && "opacity-50",
      )}
      style={{ paddingInlineStart: 10 + depth * INDENT }}
    >
      <Guides depth={depth} />
      <Icon className={cn("size-3.5 shrink-0", !active && "text-muted-foreground")} aria-hidden="true" />
      <span className={cn("min-w-0 truncate", current && "font-medium")}>{row.title}</span>
      {current && <Check className="size-3.5 shrink-0 text-primary" aria-label="Open now" />}
      <span className="flex-1" />
      {flat && row.trail && (
        <span className="max-w-[50%] shrink-0 truncate text-muted-foreground text-xs">{row.trail}</span>
      )}
      {deleting && <LoaderCircle className="mx-1.5 size-3.5 shrink-0 animate-spin" aria-label="Deleting" />}
      {!deleting && onDelete && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Delete ${row.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            !active && "invisible",
          )}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

type NewPageRowProps = {
  title: string;
  place: Place;
  active: boolean;
  creating: boolean;
  onHover: () => void;
  onCreate: () => void;
};

/** The row under the matches that makes a page titled with what is typed, naming the folder it lands in. */
function NewPageRow({ title, place, active, creating, onHover, onCreate }: NewPageRowProps) {
  const Icon = creating ? LoaderCircle : FilePlus2;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: an option of the listbox the focused search field steers by arrow keys and Enter
    <div
      role="option"
      aria-selected={active}
      aria-busy={creating || undefined}
      data-row={NEW}
      onMouseMove={onHover}
      onClick={() => creating || onCreate()}
      className={cn(
        "flex h-8 cursor-default items-center gap-2.5 rounded-md ps-2.5 pe-2.5",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon
        className={cn("size-3.5 shrink-0", creating && "animate-spin", !active && "text-muted-foreground")}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">
        {creating ? "Making" : "New page"} <span className="font-medium">{title}</span>
      </span>
      <span className="flex-1" />
      <span className="max-w-[50%] shrink-0 truncate text-muted-foreground text-xs">
        {place.trail ? `in ${place.trail}` : "at the top"}
      </span>
    </div>
  );
}

/** The vertical line under each folder a row sits in, as a file tree draws them. */
function Guides({ depth }: { depth: number }) {
  return Array.from({ length: depth }, (_, level) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a level has no identity beyond its place
      key={level}
      aria-hidden="true"
      className="absolute inset-y-0 w-px bg-border"
      style={{ insetInlineStart: 16 + level * INDENT }}
    />
  ));
}

/**
 * The outline as the picker's rows, each folder before what it holds, with the folders above each row as its trail.
 *
 * @example rowsOf([{ title: "Guides", url: null, path: null, children: [{ title: "Setup", url: "/guides/setup", path: "docs/guides/setup.mdx", children: [] }] }]); // [Guides, Setup with trail "Guides"]
 */
function rowsOf(outline: PageOutline[], depth = 0, trail: string[] = []): Row[] {
  return outline.flatMap((node) => [
    {
      key: node.url ?? `${trail.join("/")}/${node.title}`,
      title: node.title,
      url: node.url,
      path: node.path,
      depth,
      trail: trail.join(" / "),
      folder: node.children.length > 0,
    },
    ...rowsOf(node.children, depth + 1, [...trail, node.title]),
  ]);
}

/**
 * Where a new page goes from the page on screen: inside it when it is a folder's own page, else beside it.
 *
 * @example placeBeside(technical); // { folder: "docs/writing/technical", trail: "Writing / Technical" }
 */
function placeBeside(row: Row | undefined): Place {
  if (!row?.path || dirOf(row.path) === DOCS_ROOT) return { folder: DOCS_ROOT, trail: "" };
  if (isSectionIndex(row.path))
    return { folder: dirOf(row.path), trail: [row.trail, row.title].filter(Boolean).join(" / ") };
  return { folder: dirOf(row.path), trail: row.trail };
}

/** Whether a row is a page the studio may delete: one with a file of its own that is not the site's front page. */
function canDelete(row: Row) {
  return row.path !== null && !isRoot(row.path);
}

/** Why a change was refused, in the words of the first refusal when the service names one. */
function reasonOf(error: Error) {
  const [first] = (error instanceof LiveEditFailure && error.answer.refusals) || [];
  return first ? first.reason : error.message;
}

/**
 * Whether an address the router shows is the page a row opens, whatever escaping or trailing slash it carries.
 *
 * @example samePage("/you/notes/guides/setup", "/you/notes/guides/setup/"); // true
 */
function samePage(url: string, pathname: string) {
  const plain = (path: string) => decodeURI(path).replace(/\/+$/, "") || "/";
  return plain(url) === plain(pathname);
}
