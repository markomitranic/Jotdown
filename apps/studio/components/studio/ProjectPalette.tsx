"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "cn";
import { useQuery } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  Check,
  Cloud,
  FolderPlus,
  HardDrive,
  House,
  Lock,
  LogOut,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { optimizable } from "@jotdown/core/lib/images";
import { formatProjectKey, parseProjectKey, withoutGitHub } from "@/lib/project-key";
import type { SetupTarget } from "@/lib/setup";
import { FolderBrowser } from "./FolderBrowser";
import { addFolder, inApp, pickFolder } from "./folders";
import { GroupLabel, Key, Note } from "./PaletteParts";
import { openSetup } from "./setup/store";
import { discoverProjects, type Bookmark, type ProjectListing } from "./projects";
import { openSignIn, useAccount, useSignOut, type AccountAnswer } from "./account/account";
import { UpdateNotice } from "./account/UpdateNotice";
import { GitHubMark } from "@jotdown/core/components/brand-icons";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: { login: string; name: string };
  current?: { key: string; title: string };
  /** The editor's bookmarks, or `null` while GitHub has not answered for them yet. */
  bookmarks: Bookmark[] | null;
  bookmarkError: string;
  /** Asks GitHub for every project the editor can reach, so a story can answer from memory. */
  discover?: () => Promise<ProjectListing[]>;
  onChoose: (key: string, title: string | null, bookmark: boolean) => void;
  onForget: (key: string) => void;
  /** Adds a project to the editor's list without opening it. */
  onSave: (key: string, title: string) => void;
  startOn?: Screen;
};

/** The palette's screens: the editor's bookmarks, adding a project, and walking the machine's folders. */
export type Screen = "bookmarks" | "add" | "folders";

type Row = {
  key: string;
  title: string;
  kind: "add" | "folders" | "create" | "typed" | "bookmark" | "discovered";
  icon?: string | null;
  folder?: string;
  /** A folder's GitHub organisation, read off its git `origin`. */
  owner?: string;
  locked?: boolean;
  bookmarked?: boolean;
  pinned?: boolean;
};

/** The group of projects that belong to no GitHub organisation: folders outside git, or with no `origin` on GitHub. */
const NO_ORGANIZATION = "";

/**
 * The project switcher: the editor's projects, and a second screen for adding one, made new or already there.
 *
 * The first screen is only what this browser bookmarked, so it opens without
 * asking GitHub for every repository. Typing filters it, and when nothing
 * matches, Enter carries the search to the second screen. "Add a project"
 * leads there: "Set up a new project" opens the setup wizard, "Add a local
 * project" a folder on this machine, and below them GitHub's list of reachable
 * projects is searched by the same field, which also takes a pasted repository
 * address. Those action rows stay put while the lists filter. Opening a
 * project from there bookmarks it. Escape goes back.
 *
 * Every list is grouped by GitHub organisation, a folder under the one its git
 * `origin` belongs to, and each row ends in where it lives: its path or key,
 * and a cloud or a disk. The machine's folders are walked on a third screen, reached from the second or by typing a path on the first, and going
 * back from it returns to whichever of those it came from. A found
 * project can be added to the list, or taken off it, without opening it.
 *
 * @example <ProjectPalette open={open} onOpenChange={setOpen} editor={editor} bookmarks={bookmarks} bookmarkError="" onChoose={start} onForget={forgetProject} />
 */
export function ProjectPalette({
  open,
  onOpenChange,
  editor,
  current,
  bookmarks,
  bookmarkError,
  discover = discoverProjects,
  onChoose,
  onForget,
  onSave,
  startOn = "bookmarks",
}: Props) {
  const [screen, setScreen] = useState<Screen>("bookmarks");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(1);
  const [folderStart, setFolderStart] = useState("~/");
  const [folderBack, setFolderBack] = useState<Screen>("add");
  const [pickProblem, setPickProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const auth = useAccount().data;
  const signedOut = auth?.account === null;
  const discovery = useQuery({
    queryKey: ["projects", "discovered"],
    queryFn: discover,
    enabled: open && screen === "add" && !signedOut,
  });
  const discovered = discovery.data;
  const known = bookmarks ?? [];

  const reset = useEffectEvent(() => {
    setQuery("");
    goTo(startOn);
  });

  useEffect(() => {
    if (open) reset();
  }, [open]);

  const shown = screen === "bookmarks" ? bookmarkRows(known, query) : discoveredRows(discovered ?? [], known, query);
  const typed = typedRow(query, shown);
  const path = looksLikePath(query);
  const add: Row = {
    key: "add",
    title: query && !path ? `Search GitHub for “${query.trim()}”` : "Add a project",
    kind: "add",
  };
  const folders: Row = {
    key: "folders",
    title: path ? `Browse ${query.trim()}` : "Add a local project",
    kind: "folders",
  };
  const create: Row = { key: "create", title: "Set up a new project", kind: "create" };
  const groups = groupByOrganisation(shown);
  const listed = groups.flatMap((group) => group.rows).filter((row) => !row.locked);
  const leading = screen === "bookmarks" ? [path ? folders : add] : [create, folders];
  const rows = [...leading, ...(typed ? [typed] : []), ...listed];
  const at = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  function goTo(next: Screen) {
    setScreen(next);
    if (next === "bookmarks") setQuery("");
    setActive(next === "bookmarks" ? 1 : query ? 2 : 0);
    input.current?.focus();
  }

  function choose(row: Row) {
    if (row.kind === "add") return goTo("add");
    if (row.kind === "folders") {
      if (inApp() && !path) return pickNatively();
      setFolderStart(path ? query.trim() : "~/");
      setFolderBack(screen);
      return goTo("folders");
    }
    if (row.kind === "create") return setUp(null);
    if (row.key === current?.key) return onOpenChange(false);
    onChoose(row.key, row.kind === "typed" ? null : row.title, row.kind !== "bookmark");
  }

  /** The app's own folder picker: a project opens, any other folder goes to the setup wizard. */
  async function pickNatively() {
    setPickProblem("");
    try {
      const picked = await pickFolder();
      if (!picked.path) return;
      if (!picked.title) return setUp({ kind: "folder", path: picked.path });
      const added = await addFolder(picked.path);
      onChoose(added.key, added.title, false);
    } catch (error) {
      setPickProblem(error instanceof Error ? error.message : "The folder could not be added.");
    }
  }

  function signIn() {
    onOpenChange(false);
    openSignIn();
  }

  /** Swaps the switcher for the setup wizard, on a folder when one is named. */
  function setUp(start: SetupTarget | null) {
    onOpenChange(false);
    openSetup(start);
  }

  function steer(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((at + step + rows.length) % Math.max(rows.length, 1));
    }
    if (event.key === "Enter" && rows[at]) {
      event.preventDefault();
      choose(rows[at]);
    }
    if (event.key === "Backspace" && query === "" && screen === "add") goTo("bookmarks");
  }

  const rowProps = (row: Row) => {
    const index = rows.indexOf(row);
    return {
      row,
      index,
      active: index === at,
      current: row.key === current?.key,
      onHover: () => setActive(index),
      onChoose: () => choose(row),
      onForget: () => onForget(row.key),
      onSave: () => onSave(row.key, row.title),
    };
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (screen === "bookmarks") return;
            event.preventDefault();
            goTo(screen === "folders" ? folderBack : "bookmarks");
          }}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground text-sm shadow-2xl outline-none ring-1 ring-foreground/10 data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <DialogPrimitive.Title className="sr-only">
            {screen === "bookmarks" ? "Switch project" : screen === "folders" ? "Add a local project" : "Add a project"}
          </DialogPrimitive.Title>

          {screen === "folders" ? (
            <FolderBrowser
              start={folderStart}
              onBack={() => goTo(folderBack)}
              onAdded={(key, title) => onChoose(key, title, false)}
              onSetUp={(path) => setUp({ kind: "folder", path })}
            />
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-3 border-border border-b px-4">
                {screen === "bookmarks" ? (
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    aria-label="Back to your projects"
                    onClick={() => goTo("bookmarks")}
                    className="-ms-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                )}
                <input
                  ref={input}
                  // biome-ignore lint/a11y/noAutofocus: the switcher is a dialog opened to type in
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(leading.length);
                  }}
                  onKeyDown={steer}
                  placeholder={
                    screen === "bookmarks"
                      ? "Search your projects"
                      : "Search GitHub, or paste a repository address or a path"
                  }
                  aria-label={screen === "bookmarks" ? "Search your projects" : "Search GitHub"}
                  spellCheck={false}
                  className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div
                ref={list}
                role="listbox"
                aria-label={screen === "bookmarks" ? "Your projects" : "Add a project"}
                className="min-h-0 flex-1 overflow-y-auto p-1.5"
              >
                {screen === "add" && <PaletteRow {...rowProps(create)} mark={<Sparkles className="size-3" />} />}
                {leading.includes(folders) && (
                  <PaletteRow {...rowProps(folders)} mark={<FolderPlus className="size-3.5" />} />
                )}
                {leading.includes(add) && <PaletteRow {...rowProps(add)} mark={<Plus className="size-3.5" />} />}
                {typed && <PaletteRow {...rowProps(typed)} mark={<Plus className="size-3.5" />} note="Add and open" />}

                {screen === "bookmarks" && !bookmarks && <LoadingRows label="Loading your projects…" />}
                {screen === "add" && discovery.isLoading && <LoadingRows label="Loading GitHub Autodiscovery…" />}
                {screen === "add" && signedOut && <SignInNote onSignIn={() => signIn()} />}
                {screen === "add" && discovery.error && (
                  <Note alert>GitHub would not list your projects: {discovery.error.message}</Note>
                )}
                {pickProblem && <Note alert>{pickProblem}</Note>}
                {screen === "bookmarks" && bookmarkError && (
                  <Note alert>GitHub would not check your bookmarks: {bookmarkError}</Note>
                )}

                {groups.map((group) => (
                  <section key={group.owner} aria-label={group.owner || "No organization"}>
                    <GroupLabel>{group.owner === NO_ORGANIZATION ? "No organization" : group.owner}</GroupLabel>
                    {group.rows.map((row) =>
                      row.locked ? (
                        <LockedRow key={row.key} row={row} onForget={() => onForget(row.key)} />
                      ) : (
                        <PaletteRow key={row.key} {...rowProps(row)} detail={row.folder ?? row.key} />
                      ),
                    )}
                  </section>
                ))}

                {screen === "bookmarks" && known.length > 0 && query && !path && groups.length === 0 && !typed && (
                  <Note>None of your projects match. Enter searches GitHub.</Note>
                )}
                {screen === "add" && discovered && query && groups.length === 0 && !typed && (
                  <Note>Nothing on GitHub matches. Paste its owner/repo.</Note>
                )}
              </div>

              {screen === "bookmarks" && (
                <Identity
                  editor={editor}
                  auth={auth}
                  home={current !== undefined}
                  onSignIn={signedOut ? signIn : undefined}
                />
              )}
              <p className="flex shrink-0 items-center gap-4 border-border border-t bg-secondary/50 px-4 py-2 text-muted-foreground text-xs">
                <span>
                  <Key>↑</Key> <Key>↓</Key> Navigate
                </span>
                <span>
                  <Key>Enter</Key> Open
                </span>
                <span>
                  <Key>Esc</Key> {screen === "bookmarks" ? "Close" : "Back"}
                </span>
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type RowProps = {
  row: Row;
  index: number;
  active: boolean;
  current: boolean;
  detail?: string;
  note?: string;
  mark?: ReactNode;
  onHover: () => void;
  onChoose: () => void;
  onForget: () => void;
  onSave: () => void;
};

/**
 * One row: its icon, its name with a tick when it is open, and where it lives, its path or key and a cloud or a disk.
 *
 * A project's bookmark takes no room: it floats over the end of the row while
 * the row is pointed at or highlighted, and always on a touch screen, on the
 * editor's list and on GitHub's alike. A pinned project has none.
 */
function PaletteRow({
  row,
  index,
  active,
  current,
  detail,
  note,
  mark,
  onHover,
  onChoose,
  onForget,
  onSave,
}: RowProps) {
  const project = (row.kind === "bookmark" || row.kind === "discovered") && !row.pinned;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: an option of the listbox the focused search field steers by arrow keys and Enter
    <div
      role="option"
      aria-selected={active}
      data-row={index}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        "relative flex h-9 cursor-default items-center gap-2.5 rounded-md ps-2.5 pe-2.5",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <RowIcon row={row} current={current} mark={mark} />
      <span className="min-w-0 truncate">{row.title}</span>
      {current && <Check className="size-3.5 shrink-0 text-primary" aria-label="Open now" />}
      <span className="flex-1" />
      {detail && (
        <span className="max-w-[45%] shrink-0 truncate font-mono text-muted-foreground text-xs">{detail}</span>
      )}
      {detail && <Location folder={Boolean(row.folder)} />}
      {note && <span className="shrink-0 text-muted-foreground text-xs">{note}</span>}
      {project && (
        <span
          className={cn("absolute inset-y-0 end-1 items-center", active ? "flex" : "hidden [@media(hover:none)]:flex")}
        >
          <RowBookmark row={row} onSave={onSave} onForget={onForget} />
        </span>
      )}
    </div>
  );
}

/** Whether a project lives on GitHub or on this computer, as a small mark after its path. */
function Location({ folder }: { folder: boolean }) {
  const Mark = folder ? HardDrive : Cloud;
  return (
    <Mark className="size-3.5 shrink-0 text-muted-foreground" aria-label={folder ? "On this computer" : "On GitHub"} />
  );
}

/**
 * A project's place in the editor's list, floating over the end of its row: a filled bookmark that takes it off, or an outline that adds it without opening it.
 */
function RowBookmark({ row, onSave, onForget }: { row: Row; onSave: () => void; onForget: () => void }) {
  const listed = row.kind === "bookmark" || row.bookmarked;
  const label = listed ? "Remove from your list" : "Add to your list";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${row.title}`}
          aria-pressed={listed}
          onClick={(event) => {
            event.stopPropagation();
            if (listed) onForget();
            else onSave();
          }}
          className={cn(
            "grid size-7 place-items-center rounded-md bg-popover shadow-sm outline-none ring-1 ring-foreground/10 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
            listed ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <BookmarkIcon className={cn("size-3.5", listed && "fill-current")} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * GitHub's list on its way: what it is, and the shape of a group of projects in quiet bars, so the wait never looks like an empty list.
 */
function LoadingRows({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <GroupLabel>{label}</GroupLabel>
      <div aria-hidden="true">
        <span className="mx-2.5 mt-2 mb-2.5 block h-2 w-24 rounded-full bg-muted" />
        <SkeletonRow title="w-36" detail="w-40" />
        <SkeletonRow title="w-28" detail="w-48" />
        <SkeletonRow title="w-44" detail="w-36" />
      </div>
    </div>
  );
}

function SkeletonRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-9 items-center gap-2.5 ps-2.5 pe-2.5">
      <span className="size-5 shrink-0 rounded bg-muted" />
      <span className={cn("h-2.5 rounded-full bg-muted", title)} />
      <span className={cn("ms-auto h-2 rounded-full bg-muted/70", detail)} />
      <span className="size-3.5 shrink-0 rounded-full bg-muted/70" />
    </div>
  );
}

/**
 * A bookmark that cannot open: struck through behind a lock, never highlighted, saying why when pointed at or clicked.
 *
 * GitHub not showing the editor a project is one reason; a bookmarked folder
 * that is gone, or no longer a project, is the other, and that one can be removed.
 */
function LockedRow({ row, onForget }: { row: Row; onForget: () => void }) {
  const [told, setTold] = useState(false);
  const why = row.folder
    ? "This folder is gone, or no longer a Jotdown project"
    : "You don't have access to this project";

  return (
    <Tooltip open={told} onOpenChange={setTold} delayDuration={150}>
      <TooltipTrigger asChild>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: a disabled option of the listbox the focused search field steers, never reached by the keyboard */}
        <div
          role="option"
          aria-selected={false}
          aria-disabled="true"
          aria-description={why}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setTold(true)}
          className="group relative flex h-9 cursor-not-allowed items-center gap-2.5 rounded-md ps-2.5 pe-2.5 text-muted-foreground"
        >
          <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded border border-border">
            <Lock className="size-3" />
          </span>
          <span className="min-w-0 flex-1 truncate line-through decoration-muted-foreground/60">{row.title}</span>
          <span className="max-w-[45%] shrink-0 truncate font-mono text-xs opacity-60">{row.folder ?? row.key}</span>
          <Location folder={Boolean(row.folder)} />
          {row.folder && (
            <span className="absolute inset-y-0 end-1 hidden items-center group-hover:flex [@media(hover:none)]:flex">
              <RowBookmark row={row} onSave={() => {}} onForget={onForget} />
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{why}</TooltipContent>
    </Tooltip>
  );
}

/** A project's favicon or logo, read from its repository, or its initial when it has neither or the image fails. */
function RowIcon({ row, current, mark }: { row: Row; current: boolean; mark?: ReactNode }) {
  const [failed, setFailed] = useState(false);

  if (!mark && row.icon && !failed) {
    return (
      <Image
        src={row.icon}
        alt=""
        width={20}
        height={20}
        unoptimized={!optimizable(row.icon)}
        onError={() => setFailed(true)}
        className="size-5 shrink-0 rounded object-contain"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded font-semibold text-[0.6875rem] uppercase",
        current && "bg-primary text-primary-foreground",
        !current && row.kind === "create" && "border border-border border-dashed text-muted-foreground",
        !current && row.kind !== "create" && "border border-border bg-secondary text-muted-foreground",
      )}
    >
      {mark ?? row.title.replace(/^.*\//, "").charAt(0)}
    </span>
  );
}

/**
 * Who is editing, in one line above the keys: their GitHub picture or initial and name, the way in or out of GitHub, the way back to the welcome page from inside a project, and a waiting update.
 *
 * A token from `STUDIO_DEV_TOKEN` cannot be signed out of here, so it offers no Sign out.
 */
type IdentityProps = {
  editor: { login: string; name: string };
  auth: AccountAnswer | undefined;
  home: boolean;
  onSignIn?: () => void;
};

function Identity({ editor, auth, home, onSignIn }: IdentityProps) {
  const signOut = useSignOut();
  const account = auth?.account;

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-border border-t px-4 py-2">
      {account ? (
        // biome-ignore lint/performance/noImgElement: a 24px avatar from GitHub's own image host
        <img src={account.avatarUrl} alt="" className="size-6 shrink-0 rounded-full" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-medium text-muted-foreground text-xs uppercase"
        >
          {editor.name.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{account?.name ?? editor.name}</span>
        <span className="ms-1.5 text-muted-foreground text-xs">@{account?.login ?? editor.login}</span>
      </span>
      <UpdateNotice className="h-auto px-2 py-1 text-primary text-xs hover:bg-accent focus-visible:bg-accent" />
      {onSignIn && (
        <button type="button" onClick={onSignIn} className={FOOTER_ACTION}>
          <GitHubMark />
          Sign in to GitHub
        </button>
      )}
      {home && (
        <a href="/" className={FOOTER_ACTION}>
          <House className="size-3.5" aria-hidden="true" />
          Studio home
        </a>
      )}
      {account && auth?.source === "keychain" && (
        <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending} className={FOOTER_ACTION}>
          <LogOut aria-hidden="true" />
          Sign out
        </button>
      )}
    </div>
  );
}

/**
 * Where GitHub's projects would be listed, while the studio is not signed in to GitHub.
 *
 * @example <SignInNote onSignIn={signIn} />
 */
function SignInNote({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2 text-muted-foreground">
      <span className="flex-1">Sign in to GitHub to find your projects there.</span>
      <button
        type="button"
        onClick={onSignIn}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-foreground text-xs outline-none hover:bg-accent focus-visible:bg-accent"
      >
        <GitHubMark className="size-3.5" />
        Sign in
      </button>
    </div>
  );
}

const FOOTER_ACTION =
  "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent [&_svg]:size-3.5";

function bookmarkRows(bookmarks: Bookmark[], query: string) {
  return bookmarks
    .filter((bookmark) => matches(query, bookmark.key, bookmark.title))
    .map(
      (bookmark): Row => ({
        key: bookmark.key,
        title: bookmark.title,
        kind: "bookmark",
        icon: bookmark.icon,
        locked: bookmark.locked,
        folder: bookmark.folder,
        owner: bookmark.owner,
        pinned: bookmark.pinned,
      }),
    );
}

function discoveredRows(listings: ProjectListing[], bookmarks: Bookmark[], query: string) {
  const listed = new Map(bookmarks.map((bookmark) => [bookmark.key.toLowerCase(), bookmark]));
  return listings
    .filter((listing) => matches(query, listing.key, listing.title))
    .map((listing): Row => {
      const bookmark = listed.get(listing.key.toLowerCase());
      return {
        key: listing.key,
        title: listing.title,
        kind: "discovered",
        icon: listing.icon,
        bookmarked: Boolean(bookmark),
        pinned: bookmark?.pinned,
      };
    });
}

/**
 * The GitHub organisation a row belongs to: its key's owner, or for a folder the owner of its git `origin`.
 *
 * @example organisationOf({ key: "local/web", folder: "~/Sites/web", owner: "you", … }); // "you"
 */
function organisationOf(row: Row) {
  return row.folder ? (row.owner ?? NO_ORGANIZATION) : (row.key.split("/")[0] ?? row.key);
}

/** Rows grouped by GitHub organisation in name order, folders among them, and the ones with none last. A group lists GitHub before folders under one name. */
function groupByOrganisation(rows: Row[]) {
  const owners = [...new Set(rows.map(organisationOf))].sort(
    (a, b) => Number(a === NO_ORGANIZATION) - Number(b === NO_ORGANIZATION) || byName(a, b),
  );

  return owners.map((owner) => ({
    owner,
    rows: rows
      .filter((row) => organisationOf(row) === owner)
      .sort((a, b) => byName(a.title, b.title) || Number(Boolean(a.folder)) - Number(Boolean(b.folder))),
  }));
}

function typedRow(query: string, shown: Row[]): Row | null {
  const parts = parseProjectKey(query);
  if (!parts) return null;
  const key = formatProjectKey(parts);
  if (shown.some((row) => row.key.toLowerCase() === key.toLowerCase())) return null;
  return { key, title: `Add ${key}`, kind: "typed" };
}

/**
 * Whether the field holds a path on this machine rather than a search or a key.
 *
 * @example looksLikePath("~/Sites"); // true
 * @example looksLikePath("you/site"); // false
 */
function looksLikePath(query: string) {
  return /^(~|\/)/.test(query.trim());
}

function matches(query: string, key: string, title: string) {
  const needle = withoutGitHub(query).toLowerCase();
  return needle === "" || key.toLowerCase().includes(needle) || title.toLowerCase().includes(needle);
}

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}
