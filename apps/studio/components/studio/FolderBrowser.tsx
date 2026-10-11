"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "cn";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Folder, FolderOpen } from "lucide-react";
import { useModifier } from "@jotdown/core/components/shortcuts";
import { Button } from "@jotdown/core/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemMedia, ItemTitle } from "@jotdown/core/components/ui/item";
import { Kbd } from "@jotdown/core/components/ui/kbd";
import { addFolder, browseFolder, type FolderListing } from "./folders";
import { GroupLabel, Key, Note } from "./PaletteParts";

type Props = {
  start?: string;
  onBack: () => void;
  onAdded: (key: string, title: string) => void;
  /** Opens the setup wizard on a folder that is not a project yet. */
  onSetUp: (path: string) => void;
  browse?: (path: string) => Promise<FolderListing>;
  add?: (path: string) => Promise<{ key: string; title: string | null }>;
};

type Entry = FolderListing["entries"][number];

/**
 * The switcher's folder browser: walk this machine's folders by keyboard, bookmark one that is a Jotdown project, or set up docs in one that is not.
 *
 * The field is a path. Typing past the last `/` narrows the folders listed,
 * Enter goes into a folder or adds a project, deleting back past a `/` climbs
 * out, and ⌘Enter adds the folder the field names. A folder with no docs is
 * not added: the browser asks whether to set docs up there instead.
 *
 * @example <FolderBrowser onBack={() => goTo("bookmarks")} onAdded={(key, title) => onChoose(key, title, false)} onSetUp={(path) => setUp({ kind: "folder", path })} />
 */
export function FolderBrowser({
  start = "~/",
  onBack,
  onAdded,
  onSetUp,
  browse = browseFolder,
  add = addFolder,
}: Props) {
  const [query, setQuery] = useState(start.endsWith("/") ? start : `${start}/`);
  const [active, setActive] = useState(0);
  const [asking, setAsking] = useState<FolderListing | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const modifier = useModifier();

  const folder = query.slice(0, query.lastIndexOf("/") + 1) || "~/";
  const browsing = useQuery({
    queryKey: ["folders", folder],
    queryFn: () => browse(folder),
    placeholderData: keepPreviousData,
  });
  const adding = useMutation({ mutationFn: add, onSuccess: (added) => onAdded(added.key, added.title ?? added.key) });
  const listing = browsing.isError ? null : (browsing.data ?? null);
  const problem = adding.error?.message ?? browsing.error?.message ?? "";
  const busy = adding.isPending || adding.isSuccess;
  const needle = query.slice(folder.length).toLowerCase();
  const rows = (listing?.entries ?? []).filter((entry) => entry.name.toLowerCase().includes(needle));
  const at = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  /** Adds the folder on screen when it is a project, or asks whether to set one up there when it is not. */
  function addHere() {
    if (!listing) return;
    if (listing.title) return void addAt(listing.path);
    setAsking(listing);
  }

  function addAt(path: string) {
    if (!busy) adding.mutate(path);
  }

  function choose(entry: Entry) {
    if (entry.title) return void addAt(entry.path);
    setQuery(`${inside(listing?.display ?? folder, entry.name)}/`);
    setActive(0);
    input.current?.focus();
  }

  function steer(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((at + step + rows.length) % Math.max(rows.length, 1));
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      addHere();
      return;
    }
    if (event.key === "Enter" && rows[at]) {
      event.preventDefault();
      choose(rows[at]);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-border border-b px-4">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="-ms-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <input
          ref={input}
          // biome-ignore lint/a11y/noAutofocus: the folder browser is a dialog screen opened to type a path in
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setAsking(null);
            adding.reset();
          }}
          onKeyDown={steer}
          aria-label="Folder"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[0.875rem] outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!listing || busy}
          onClick={addHere}
          title={listing?.title ? `Add ${listing.title}` : undefined}
        >
          Add
          <Kbd>{modifier} Enter</Kbd>
        </Button>
      </div>

      {asking && <SetUpInstead folder={asking} onSetUp={() => onSetUp(asking.path)} onCancel={() => setAsking(null)} />}

      <div
        ref={list}
        role="listbox"
        aria-label="Folders"
        hidden={asking !== null}
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {problem && <Note alert>{problem}</Note>}
        {!listing && !problem && <Note>Reading {folder}…</Note>}
        {listing && (
          <>
            <GroupLabel>{listing.title ? `${listing.title}, a Jotdown project` : "Folders"}</GroupLabel>
            {rows.map((entry, index) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: an option of the listbox the focused path field steers by arrow keys and Enter
              <div
                key={entry.path}
                role="option"
                aria-selected={index === at}
                data-row={index}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(entry)}
                className={cn(
                  "flex h-9 cursor-default items-center gap-2.5 rounded-md ps-2.5 pe-2.5",
                  index === at && "bg-accent text-accent-foreground",
                )}
              >
                {entry.title ? (
                  <BookOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                {entry.title && (
                  <span className="max-w-[45%] shrink-0 truncate text-muted-foreground text-xs">{entry.title}</span>
                )}
              </div>
            ))}
            {rows.length === 0 && <Note>{needle ? `No folder here matches “${needle}”.` : "No folders here."}</Note>}
          </>
        )}
      </div>

      <p className="flex shrink-0 items-center gap-4 border-border border-t bg-secondary/50 px-4 py-2 text-muted-foreground text-xs">
        <span>
          <Key>↑</Key> <Key>↓</Key> Navigate
        </span>
        <span>
          <Key>Enter</Key> Open or add
        </span>
        <span>
          <Key>{modifier}</Key> <Key>Enter</Key> Add this folder
        </span>
        <span>
          <Key>Esc</Key> Back
        </span>
      </p>
    </>
  );
}

/**
 * The question asked when the folder being added has no docs: adding it would open nothing, so offer to set docs up there instead.
 *
 * Set up is in focus, so Enter takes it.
 */
function SetUpInstead({
  folder,
  onSetUp,
  onCancel,
}: {
  folder: FolderListing;
  onSetUp: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 p-3">
      <Item
        role="alertdialog"
        aria-labelledby="folder-no-docs"
        aria-describedby="folder-no-docs-why"
        variant="outline"
        className="border-border"
      >
        <ItemMedia variant="icon">
          <FolderOpen className="text-muted-foreground" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle id="folder-no-docs">
            No docs in <span className="font-mono text-[0.8125rem]">{folder.display}</span> yet
          </ItemTitle>
          <ItemDescription id="folder-no-docs-why" className="line-clamp-none">
            It has no <code>.jotdown/config.json</code>, so adding it would open an empty project. Set up a docs site
            here instead?{" "}
            <strong className="font-semibold text-foreground">
              Nothing will be written until you complete the installation steps.
            </strong>
          </ItemDescription>
        </ItemContent>
        <ItemFooter className="justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" autoFocus onClick={onSetUp}>
            Set up docs here
          </Button>
        </ItemFooter>
      </Item>
    </div>
  );
}

/**
 * A folder's path inside another, as the field writes it.
 *
 * @example inside("~", "Sites"); // "~/Sites"
 * @example inside("/", "opt"); // "/opt"
 */
function inside(parent: string, name: string) {
  return parent.endsWith("/") ? `${parent}${name}` : `${parent}/${name}`;
}
