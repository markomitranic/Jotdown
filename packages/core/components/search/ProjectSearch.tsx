"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AlignLeft, FileText, Hash, Search } from "lucide-react";
import type { SearchDialogProps } from "@jotdown/core/components/docs/search";
import type { SearchDocument, SearchSection } from "@jotdown/core/server/search";
import { Button } from "@jotdown/core/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { useModifier } from "@jotdown/core/components/shortcuts";
import { browserIndex, forgetIndex } from "./browser-index";
import {
  findLiteral,
  fromRanked,
  isLiteral,
  LITERAL_LIMIT,
  queryPattern,
  segments,
  snippet,
  type FindOptions,
  type Match,
} from "./find";
import { SourcePreview } from "./SourcePreview";

type SearchScope = { base: string; sections: SearchSection[] };

let published: SearchScope = { base: "", sections: [] };
const listeners = new Set<() => void>();

/**
 * Hands the open project's base and search sections to the search dialog, and starts its index once the page is idle.
 *
 * The dialog lives above the project in the tree, so the shell publishes the
 * sections from inside it rather than passing them down.
 *
 * @example <PublishSearchSections base={project.base} sections={searchSections(source)} />
 */
export function PublishSearchSections({ base, sections }: SearchScope) {
  useEffect(() => {
    published = { base, sections };
    for (const listener of listeners) listener();

    const warm = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1000));
    warm(() => browserIndex(base, sections));
  }, [base, sections]);

  return null;
}

function useSearchScope() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => published,
    () => published,
  );
}

/**
 * Find in files for the open project: a query with its options, a tab per section, the results, and the source of the one selected.
 *
 * The arrow keys walk the results and the preview follows. Enter, a double
 * click or Open goes to the result, in a new browser tab when the box says so
 * or ⌘ is held. The query stays for the next time the dialog opens, unless
 * text is selected on the page, which becomes the query instead.
 *
 * @example <RootProvider search={{ SearchDialog: ProjectSearch }} />
 */
export function ProjectSearch({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const { base, sections } = useSearchScope();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>();
  const [settings, change] = useSettings();
  const [selectedId, setSelectedId] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const literal = isLiteral(settings);
  const { matchCase, words, regex } = settings;
  const pattern = useMemo(() => queryPattern(query, { matchCase, words, regex }), [query, matchCase, words, regex]);
  const documents = useDocuments(base, sections, open);
  const ranked = useRanked(base, sections, literal ? "" : query, section);

  const matches = useMemo(() => {
    if (!pattern || !documents.data) return [];
    if (literal) return findLiteral(documents.data, pattern, section);
    return ranked.data
      ? fromRanked(ranked.data, new Map(documents.data.map((document) => [document.url, document])))
      : [];
  }, [pattern, documents.data, literal, section, ranked.data]);

  const selectedAt = Math.max(
    matches.findIndex((match) => match.id === selectedId),
    0,
  );
  const selected = matches.at(selectedAt);
  const failure = documents.error ?? (literal ? null : ranked.error);

  // biome-ignore lint/correctness/useExhaustiveDependencies: new results scroll the selected row into view again
  useEffect(() => {
    list.current?.querySelector(`[data-row="${selectedAt}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedAt, matches]);

  function go(match: Match, newTab: boolean) {
    if (newTab) return void window.open(match.url, "_blank", "noopener");
    onOpenChange(false);
    router.push(match.url);
  }

  function steer(event: KeyboardEvent) {
    const option = event.altKey && !event.metaKey && !event.ctrlKey ? OPTION_KEYS[event.code] : undefined;
    if (option) {
      event.preventDefault();
      change({ [option]: !settings[option] });
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = matches[(selectedAt + step + matches.length) % matches.length];
      if (next) setSelectedId(next.id);
    }
    if (event.key === "Enter" && selected && event.target === input.current) {
      event.preventDefault();
      go(selected, settings.newTab !== (event.metaKey || event.ctrlKey));
    }
  }

  function start(event: Event) {
    event.preventDefault();
    const picked = window.getSelection()?.toString().trim();
    if (picked && !picked.includes("\n") && picked.length <= 120) setQuery(picked);
    requestAnimationFrame(() => input.current?.select());
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={start}
          onKeyDown={steer}
          className="fixed top-1/2 left-1/2 z-50 flex h-[min(48rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground text-sm shadow-2xl outline-none ring-1 ring-foreground/10 data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>

          <div className="flex shrink-0 items-center gap-3 border-border border-b pr-2 pl-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={literal ? "Find text" : "Search"}
              aria-label="Search"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="search-results"
              aria-activedescendant={selected ? `search-result-${selectedAt}` : undefined}
              spellCheck={false}
              className={cn(
                "h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground",
                literal && "font-mono text-sm",
              )}
            />
            <Tally matches={matches} literal={literal} />
            <OptionToggles settings={settings} onChange={change} />
          </div>

          {sections.length > 1 && <SectionTabs sections={sections} section={section} onChange={setSection} />}

          <div
            ref={list}
            id="search-results"
            role="listbox"
            aria-label="Results"
            className="min-h-0 flex-[2] overflow-y-auto py-1 max-sm:flex-1"
          >
            {matches.map((match, at) => (
              <ResultRow
                key={match.id}
                match={match}
                at={at}
                pattern={pattern}
                selected={at === selectedAt}
                onSelect={() => setSelectedId(match.id)}
                onOpen={(newTab) => go(match, newTab ?? settings.newTab)}
              />
            ))}
            <Status
              query={query}
              pattern={pattern}
              loading={documents.isPending}
              failure={failure}
              empty={matches.length === 0}
            />
          </div>

          <div className="flex min-h-0 flex-[3] flex-col border-border border-t bg-background max-sm:hidden">
            {selected && (
              <>
                <PreviewHeading document={selected.document} />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SourcePreview
                    match={selected}
                    pattern={pattern}
                    version={sections.find((each) => each.id === selected.document.tag)?.key ?? ""}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 border-border border-t px-4 py-2">
            <NewTabBox checked={settings.newTab} onChange={(newTab) => change({ newTab })} />
            <Button
              size="sm"
              className="ml-auto"
              disabled={!selected}
              onClick={() => selected && go(selected, settings.newTab)}
            >
              Open
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type Settings = FindOptions & { newTab: boolean };

const SETTINGS_KEY = "search-settings";
const DEFAULT_SETTINGS: Settings = { matchCase: false, words: false, regex: false, newTab: false };
const OPTION_KEYS: Record<string, keyof FindOptions | undefined> = { KeyC: "matchCase", KeyW: "words", KeyX: "regex" };

/** The query options and the new tab box, as this browser last left them. */
function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>),
      });
    } catch {
      localStorage.removeItem(SETTINGS_KEY);
    }
  }, []);

  const change = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  };

  return [settings, change] as const;
}

/**
 * Every page of the project as search reads it, once the dialog has been opened.
 *
 * A failed download forgets the index, so asking again starts it over.
 *
 * @example const documents = useDocuments(base, sections, open); // documents.data?.length
 */
function useDocuments(base: string, sections: SearchSection[], open: boolean) {
  return useQuery({
    queryKey: ["search", "documents", base, sections],
    queryFn: () => startingOverOnFailure(browserIndex(base, sections).documents),
    enabled: open,
    staleTime: Infinity,
  });
}

/**
 * The search index's ranked results for the query in one section or all, the last ones kept until the next arrive.
 *
 * @example const ranked = useRanked(base, sections, "sidebar", undefined); // ranked.data?.[0].url
 */
function useRanked(base: string, sections: SearchSection[], query: string, section: string | undefined) {
  return useQuery({
    queryKey: ["search", "ranked", base, sections, query, section],
    queryFn: () =>
      startingOverOnFailure(
        browserIndex(base, sections).index.search(query, { tag: section === undefined ? undefined : [section] }),
      ),
    enabled: query.trim() !== "",
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

/** Passes a promise on, forgetting the index when it fails so the next try downloads afresh. */
async function startingOverOnFailure<T>(work: Promise<T>) {
  try {
    return await work;
  } catch (error) {
    forgetIndex();
    throw error;
  }
}

/** How many results there are and on how many pages. */
function Tally({ matches, literal }: { matches: Match[]; literal: boolean }) {
  if (matches.length === 0) return null;

  const pages = new Set(matches.map((match) => match.document.url)).size;
  const capped = literal && matches.length >= LITERAL_LIMIT;
  return (
    <span className="shrink-0 text-muted-foreground text-xs tabular-nums max-sm:hidden">
      {capped
        ? `${LITERAL_LIMIT}+ matches`
        : `${plural(matches.length, "match", "matches")} in ${plural(pages, "page", "pages")}`}
    </span>
  );
}

/** Match case, whole words and regex, each a toggle with its Alt key. */
function OptionToggles({ settings, onChange }: { settings: Settings; onChange: (next: Partial<Settings>) => void }) {
  const alt = useModifier() === "⌘" ? "⌥" : "Alt";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <OptionToggle
        label="Match case"
        keys={`${alt} C`}
        pressed={settings.matchCase}
        onChange={() => onChange({ matchCase: !settings.matchCase })}
      >
        Cc
      </OptionToggle>
      <OptionToggle
        label="Whole words"
        keys={`${alt} W`}
        pressed={settings.words}
        onChange={() => onChange({ words: !settings.words })}
      >
        W
      </OptionToggle>
      <OptionToggle
        label="Regex"
        keys={`${alt} X`}
        pressed={settings.regex}
        onChange={() => onChange({ regex: !settings.regex })}
      >
        .*
      </OptionToggle>
    </div>
  );
}

type OptionToggleProps = { label: string; keys: string; pressed: boolean; onChange: () => void; children: ReactNode };

function OptionToggle({ label, keys, pressed, onChange, children }: OptionToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onMouseDown={keepFocus}
          onClick={onChange}
          className={cn(
            "grid h-7 min-w-7 place-items-center rounded-md px-1.5 font-mono text-muted-foreground text-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
            pressed && "bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20 hover:text-primary",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        <span className="text-muted-foreground">{keys}</span>
      </TooltipContent>
    </Tooltip>
  );
}

type SectionTabsProps = {
  sections: SearchSection[];
  section: string | undefined;
  onChange: (section: string | undefined) => void;
};

/** All of the project first, then one tab per section. */
function SectionTabs({ sections, section, onChange }: SectionTabsProps) {
  const tabs = [{ id: undefined, title: "All" }, ...sections];

  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="flex shrink-0 gap-4 overflow-x-auto border-border border-b px-4"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id ?? "all"}
          type="button"
          role="tab"
          aria-selected={tab.id === section}
          onMouseDown={keepFocus}
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px shrink-0 border-transparent border-b-2 py-2 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:text-foreground",
            tab.id === section && "border-primary text-foreground",
          )}
        >
          {tab.title}
        </button>
      ))}
    </div>
  );
}

type ResultRowProps = {
  match: Match;
  at: number;
  pattern: RegExp | null;
  selected: boolean;
  onSelect: () => void;
  onOpen: (newTab?: boolean) => void;
};

const KIND_ICONS = { page: FileText, heading: Hash, text: AlignLeft };

/**
 * One result: what matched, with the match marked, and the page it is on.
 *
 * A click selects it and a double click opens it. A ⌘ click or a middle click
 * opens it in a new tab, and on a phone, where there is no preview, a tap opens it.
 */
function ResultRow({ match, at, pattern, selected, onSelect, onOpen }: ResultRowProps) {
  const Icon = KIND_ICONS[match.kind];

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the focused search field points at this option with aria-activedescendant
    // biome-ignore lint/a11y/useKeyWithClickEvents: the search field's arrow keys and Enter select and open it
    <div
      id={`search-result-${at}`}
      role="option"
      aria-selected={selected}
      data-row={at}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return onOpen(true);
        if (window.matchMedia("(max-width: 639px)").matches) return onOpen();
        onSelect();
      }}
      onDoubleClick={() => onOpen()}
      onAuxClick={(event) => event.button === 1 && onOpen(true)}
      className={cn(
        "flex h-7 cursor-default select-none items-center gap-2.5 px-4",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/40",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className={cn("min-w-0 flex-1 truncate", match.kind === "text" && !selected && "text-foreground/80")}>
        {segments(snippet(match.text, pattern), pattern).map((run, n) =>
          run.mark ? (
            <mark
              // biome-ignore lint/suspicious/noArrayIndexKey: runs of one string, by position, never reordered
              key={n}
              className="rounded-[2px] bg-primary/30 text-foreground"
            >
              {run.text}
            </mark>
          ) : (
            run.text
          ),
        )}
      </span>
      <span className="max-w-[40%] shrink-0 truncate text-muted-foreground text-xs">
        {match.kind === "page" ? match.document.path : match.document.title}
      </span>
    </div>
  );
}

/** Why the list is empty, when it is: loading, a regex that does not parse, nothing matched, or a failed download. */
function Status({
  query,
  pattern,
  loading,
  failure,
  empty,
}: {
  query: string;
  pattern: RegExp | null;
  loading: boolean;
  failure: Error | null;
  empty: boolean;
}) {
  const message = failure
    ? failure.message
    : !empty || query.trim() === ""
      ? null
      : !pattern
        ? "Not a valid regular expression"
        : loading
          ? "Loading search"
          : "Nothing matches";

  if (!message) return null;
  return (
    <p
      role={failure ? "alert" : "status"}
      className={cn("px-4 py-6 text-center text-muted-foreground", failure && "text-destructive")}
    >
      {message}
    </p>
  );
}

/** The selected page's file, its name bright and its folder dim. */
function PreviewHeading({ document }: { document: SearchDocument }) {
  const slash = document.path.lastIndexOf("/");

  return (
    <p className="flex shrink-0 items-baseline gap-2 border-border border-b px-4 py-2 text-xs">
      <span className="font-medium text-foreground">{document.path.slice(slash + 1)}</span>
      <span className="truncate text-muted-foreground">{`docs/${document.path.slice(0, slash + 1)}`}</span>
    </p>
  );
}

/** The box that makes Enter open results in a new browser tab, with the chord that does it once. */
function NewTabBox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const modifier = useModifier();

  return (
    <label className="flex cursor-default select-none items-center gap-2 text-muted-foreground text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-primary"
      />
      <span className="text-foreground">Open in new tab</span>
      <kbd className="font-sans">{modifier} ↵</kbd>
    </label>
  );
}

/** Leaves the focus in the query box when a tab or a toggle is clicked, so typing carries on. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
