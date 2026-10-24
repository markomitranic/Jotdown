"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Check, ChevronsUpDown, FileText, Folder, FolderOpen, Search } from "lucide-react";
import { cn } from "cn";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import { SHORTCUTS, ShortcutHint, useShortcut } from "@jotdown/core/components/shortcuts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { mayLeave } from "@jotdown/editor/client/useLeaveGuard";
import type { PageOutline } from "@/lib/page-outline";
import { Key, Note } from "../PaletteParts";
import { ITEM } from "./note";

/** One line of the picker: a page, or a folder that may open at its own page. */
type Row = { key: string; title: string; url: string | null; depth: number; trail: string; folder: boolean };

/** How far each level of the tree steps in, in pixels. */
const INDENT = 16;

/**
 * The page on screen, and a picker that goes to any other, wherever the project is drawn.
 *
 * It sits in the status strip beside the branch, because a project's own
 * layout can hide the sidebar or leave it out, and the studio still has to
 * reach every page. ⌘ P opens it from anywhere, a site's canvas included. The
 * pages are read again each time it opens, so one added a moment ago is there.
 *
 * @example <PagePicker projectId="abc123" />
 */
export function PagePicker({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pages = useQuery({
    queryKey: ["studio", "pages", projectId],
    queryFn: () =>
      fetchJson<{ pages: PageOutline[] }>(`/api/projects/${projectId}/pages`, { cache: "no-store" }).then(
        (answer) => answer.pages,
      ),
    staleTime: 60_000,
    retry: false,
  });

  const rows = rowsOf(pages.data ?? []);
  const here = rows.find((row) => row.url !== null && samePage(row.url, pathname));

  function show(next: boolean) {
    setOpen(next);
    if (next) void pages.refetch();
  }

  function go(url: string) {
    setOpen(false);
    if (here?.url !== url && mayLeave()) router.push(url);
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
        error={pages.error?.message ?? ""}
        current={here?.url ?? null}
        onChoose={go}
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
  onChoose: (url: string) => void;
};

/**
 * Every page as a tree, or the pages whose title or folder matches what is typed, as a flat list.
 *
 * It opens on the page on screen, even when the pages arrive after it does. A folder with no page of its own is a label
 * the arrow keys pass over. Typing lists only pages, each with the folders it
 * sits in, and every word typed has to match its title or one of those folders.
 */
function PagePalette({ open, onOpenChange, rows, loading, error, current, onChoose }: PaletteProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const typed = query.trim().toLowerCase();
  const words = typed.split(/\s+/);
  const shown = typed
    ? rows.filter(
        (row) => row.url !== null && words.every((word) => `${row.trail} ${row.title}`.toLowerCase().includes(word)),
      )
    : rows;
  const choosable = shown.filter((row) => row.url !== null);
  const chosen =
    choosable.find((row) => row.key === picked) ??
    (typed ? undefined : choosable.find((row) => row.url === current)) ??
    choosable[0];

  const reset = useEffectEvent(() => {
    setQuery("");
    setPicked(null);
  });

  useEffect(() => {
    if (open) reset();
  }, [open]);

  useEffect(() => {
    list.current?.querySelector(`[data-row="${chosen?.key}"]`)?.scrollIntoView({ block: "nearest" });
  }, [chosen?.key]);

  function steer(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const at = chosen ? choosable.indexOf(chosen) : -1;
      setPicked(choosable[(at + step + choosable.length) % Math.max(choosable.length, 1)]?.key ?? null);
    }
    if (event.key === "Enter" && chosen?.url) {
      event.preventDefault();
      onChoose(chosen.url);
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
              onChange={(event) => {
                setQuery(event.target.value);
                setPicked(null);
              }}
              onKeyDown={steer}
              placeholder="Search pages"
              aria-label="Search pages"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div ref={list} role="listbox" aria-label="Pages" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading && <Note>Loading the pages…</Note>}
            {error && <Note alert>The pages could not be read: {error}</Note>}
            {!loading && !error && shown.length === 0 && <Note>{typed ? "No page matches." : "No pages yet."}</Note>}
            {shown.map((row) => (
              <PageRow
                key={row.key}
                row={row}
                flat={Boolean(typed)}
                active={row === chosen}
                current={row.url !== null && row.url === current}
                onHover={() => row.url !== null && setPicked(row.key)}
                onChoose={() => row.url && onChoose(row.url)}
              />
            ))}
          </div>

          <p className="flex shrink-0 items-center gap-4 border-border border-t bg-secondary/50 px-4 py-2 text-muted-foreground text-xs">
            <span>
              <Key>↑</Key> <Key>↓</Key> Navigate
            </span>
            <span>
              <Key>Enter</Key> Open
            </span>
            <span>
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
  onHover: () => void;
  onChoose: () => void;
};

/**
 * One page or folder, stepped in by its depth with a guide line for each level above it, or flat with its folders after it.
 */
function PageRow({ row, flat, active, current, onHover, onChoose }: RowProps) {
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
      data-row={row.key}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        "relative flex h-8 cursor-default items-center gap-2.5 rounded-md pe-2.5",
        active && "bg-accent text-accent-foreground",
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
 * @example rowsOf([{ title: "Guides", url: null, children: [{ title: "Setup", url: "/guides/setup", children: [] }] }]); // [Guides, Setup with trail "Guides"]
 */
function rowsOf(outline: PageOutline[], depth = 0, trail: string[] = []): Row[] {
  return outline.flatMap((node) => [
    {
      key: node.url ?? `${trail.join("/")}/${node.title}`,
      title: node.title,
      url: node.url,
      depth,
      trail: trail.join(" / "),
      folder: node.children.length > 0,
    },
    ...rowsOf(node.children, depth + 1, [...trail, node.title]),
  ]);
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
