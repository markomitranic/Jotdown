"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import {
  ArrowLeft,
  Braces,
  CircleAlert,
  Eye,
  Fingerprint,
  History,
  LoaderCircle,
  Palette,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { Kbd } from "@jotdown/core/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { useModifier } from "@jotdown/core/components/shortcuts";
import { useDraft } from "./draft";
import { FileSection } from "./FileSection";
import { GeneralSection } from "./GeneralSection";
import { HistorySection } from "./HistorySection";
import { IdentitySection } from "./IdentitySection";
import { SettingsSearch } from "./parts";
import { closeSettings, SECTIONS, showSection, useSettings, type Section } from "./store";
import { ThemeSection } from "./ThemeSection";

const NAMES: Record<Section, { label: string; icon: typeof Palette }> = {
  general: { label: "General", icon: SlidersHorizontal },
  identity: { label: "Identity", icon: Fingerprint },
  theme: { label: "Theme", icon: Palette },
  history: { label: "History", icon: History },
  file: { label: "Config file", icon: Braces },
};

/**
 * The project's settings, drawn over the whole workspace above the status strip.
 *
 * A list of sections and a search on the left, the section on the right, and a
 * bar that floats in once the draft differs from what was saved. Escape and the
 * back button close it without losing the draft. The gear in the status strip
 * and ⌘, open it.
 *
 * @example <SettingsPanel folders={["guides"]} />
 */
export function SettingsPanel({ folders }: { folders: string[] }) {
  const { open, section } = useSettings();
  const [query, setQuery] = useState("");
  const [peeking, setPeeking] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";

  useEffect(() => {
    if (!open) return;

    function key(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        document.querySelector("[role=dialog]:not([data-settings-panel]), [data-radix-popper-content-wrapper]")
      )
        return;
      const typing =
        event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]");

      if (event.key === "Escape") {
        if (typing === search.current && query) setQuery("");
        else closeSettings();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        search.current?.focus();
      }
    }

    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Project settings"
      data-settings-panel=""
      className={cn(
        "fixed inset-x-0 top-0 bottom-(--jd-status-height) z-45 grid animate-panel-in grid-cols-[15.5rem_minmax(0,1fr)] bg-background transition-opacity duration-200 max-md:grid-cols-1",
        peeking && "opacity-0",
      )}
    >
      <nav
        aria-label="Settings sections"
        className="flex min-h-0 flex-col gap-3 border-border border-e bg-sidebar p-2.5 wco:pt-(--titlebar-height) max-md:hidden"
      >
        <label className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search the settings"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {!query && <Kbd>/</Kbd>}
        </label>

        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((each) => {
            const { label, icon: Icon } = NAMES[each];
            const current = !searching && each === section;
            return (
              <li key={each}>
                <button
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => {
                    setQuery("");
                    showSection(each);
                  }}
                  className={cn(
                    "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "bg-primary/12 font-medium text-foreground hover:bg-primary/15" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-4", current && "text-primary")} aria-hidden="true" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={closeSettings}
          className="mt-auto flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-muted-foreground text-sm outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
          <Kbd className="ms-auto">Esc</Kbd>
        </button>
      </nav>

      <div className="relative flex min-h-0 flex-col">
        <header className="flex h-12 wco:h-(--titlebar-height) shrink-0 items-center gap-2 px-6 text-sm [-webkit-app-region:drag]">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              showSection("general");
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Settings
          </button>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium">{searching ? `Results for “${query.trim()}”` : NAMES[section].label}</span>
          <PeekButton onPeek={setPeeking} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Close the settings"
            onClick={closeSettings}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        </header>

        <div className="jd-scroll-container min-h-0 flex-1 overflow-y-auto">
          <div data-results="" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-4 pb-32">
            <Body section={section} query={query} folders={folders} />
            <p className="hidden py-16 text-center text-muted-foreground text-sm [[data-results]:not(:has([data-settings-row]))_&]:block">
              No setting matches “{query.trim()}”.
            </p>
          </div>
        </div>

        <SaveBar />
      </div>
    </div>
  );
}

/**
 * A button that fades the settings away while it is held, to see the page behind wearing the draft.
 *
 * @example <PeekButton onPeek={setPeeking} />
 */
function PeekButton({ onPeek }: { onPeek: (peeking: boolean) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto text-muted-foreground"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onPeek(true);
          }}
          onPointerUp={() => onPeek(false)}
          onPointerCancel={() => onPeek(false)}
          onKeyDown={(event) => event.key === " " && onPeek(true)}
          onKeyUp={() => onPeek(false)}
          onBlur={() => onPeek(false)}
        >
          <Eye aria-hidden="true" />
          Peek
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        Hold to see the page behind, in the draft
      </TooltipContent>
    </Tooltip>
  );
}

/** The open section, or every section at once while a search narrows them. */
function Body({ section, query, folders }: { section: Section; query: string; folders: string[] }) {
  const draft = useDraft();

  if (draft.status === "loading" || draft.status === "idle") {
    return (
      <p className="flex items-center gap-2 py-16 text-muted-foreground text-sm" data-settings-row="">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Reading the config…
      </p>
    );
  }

  if (draft.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3 py-16 text-sm" data-settings-row="">
        <p className="text-destructive">{draft.problem}</p>
        <Button variant="outline" size="sm" onClick={draft.reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (query.trim()) {
    return (
      <SettingsSearch query={query}>
        {SECTIONS.map((each) => (
          <div key={each} className="flex flex-col gap-8 [&:not(:has([data-settings-row]))]:hidden">
            <h2 className="-mb-4 font-semibold text-lg">{NAMES[each].label}</h2>
            <SectionBody section={each} folders={folders} />
          </div>
        ))}
      </SettingsSearch>
    );
  }

  return <SectionBody section={section} folders={folders} />;
}

function SectionBody({ section, folders }: { section: Section; folders: string[] }) {
  const { config } = useDraft();
  if (!config && section !== "file" && section !== "history") return <Unreadable />;

  if (section === "general") return <GeneralSection />;
  if (section === "identity") return <IdentitySection />;
  if (section === "theme") return <ThemeSection folders={folders} />;
  if (section === "history") return <HistorySection />;
  return <FileSection />;
}

/** Shown in place of a form while the config's text does not read as JSON. */
function Unreadable() {
  const { syntax } = useDraft();

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
      data-settings-row=""
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="flex flex-col items-start gap-2">
        <p className="font-medium">The config file does not read as JSON.</p>
        <p className="font-mono text-muted-foreground text-xs">{syntax}</p>
        <Button variant="outline" size="sm" onClick={() => showSection("file")}>
          Fix it in the config file
        </Button>
      </div>
    </div>
  );
}

/**
 * The bar that floats up while the draft differs from the saved config: how much changed, and save or discard.
 *
 * ⌘S saves from anywhere in the panel. A save the branch refused because the
 * config moved offers both ways out: load what is there now, or save over it.
 */
function SaveBar() {
  const draft = useDraft();
  const modifier = useModifier();
  const blocked = draft.syntax !== null || draft.issues.size > 0;

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (draft.dirty && !blocked && !draft.saving) draft.save();
    }

    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [draft, blocked]);

  if (!draft.dirty && !draft.saveProblem) return null;

  const count = draft.changes.length;
  const summary = blocked
    ? `${draft.syntax ? "The file does not read" : `${draft.issues.size} ${draft.issues.size === 1 ? "problem" : "problems"} to fix`} before saving`
    : count === 0
      ? "Formatting changed"
      : `${count} unsaved ${count === 1 ? "change" : "changes"}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-6">
      <div
        role="status"
        className="pointer-events-auto flex max-w-full animate-bar-in items-center gap-3 rounded-xl border border-border bg-popover py-1.5 ps-4 pe-1.5 text-sm shadow-lg"
      >
        {draft.saveProblem ? (
          <span className="flex min-w-0 items-center gap-2 text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {draft.saveProblem.conflict
                ? "The config changed somewhere else since you opened it."
                : draft.saveProblem.message}
            </span>
          </span>
        ) : (
          <ChangeSummary text={summary} changes={draft.changes} tone={blocked ? "problem" : "plain"} />
        )}

        <span className="flex shrink-0 items-center gap-1">
          {draft.saveProblem?.conflict ? (
            <>
              <Button variant="ghost" size="sm" onClick={draft.reload}>
                Load theirs
              </Button>
              <Button size="sm" disabled={draft.saving} onClick={draft.overwrite}>
                Save mine over it
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" disabled={draft.saving} onClick={draft.discard}>
                Discard
              </Button>
              <Button size="sm" disabled={blocked || draft.saving} onClick={draft.save}>
                {draft.saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {draft.saving ? "Saving" : "Save"}
                {!draft.saving && (
                  <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                    {modifier === "⌘" ? "⌘S" : `${modifier}+S`}
                  </Kbd>
                )}
              </Button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** How many settings changed, with every one of them named under the pointer. */
function ChangeSummary({ text, changes, tone }: { text: string; changes: string[]; tone: "plain" | "problem" }) {
  const label: ReactNode = <span className={cn("truncate", tone === "problem" && "text-destructive")}>{text}</span>;
  if (changes.length === 0) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex min-w-0 cursor-default items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <span className="flex flex-col gap-0.5 font-mono text-xs">
          {changes.slice(0, 12).map((path) => (
            <span key={path}>{path}</span>
          ))}
          {changes.length > 12 && <span>and {changes.length - 12} more</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
