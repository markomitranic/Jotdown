"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { confirmInPage } from "@jotdown/core/components/confirm";
import { useDocTarget, useLiveEditConfig } from "../client/api";
import { useInplace, type Inplace } from "../inplace/context";
import type { PageRevision } from "../types";
import { usePageHistory } from "./usePageHistory";
import { RevisionDiff } from "./RevisionDiff";

/**
 * The page's committed versions, one list that opens into a single version.
 *
 * A version opens on its changes against the saved source, or its Markdown,
 * and can be loaded into the editor as a draft. Nothing is saved until the
 * editor saves as usual.
 *
 * @example <HistoryPanel onLoaded={closeDrawer} />
 */
export default function HistoryPanel({ onLoaded }: { onLoaded(): void }) {
  const history = usePageHistory();
  const [opened, setOpened] = useState(false);

  if (opened && history.selected) {
    return <Revision history={history} onBack={() => setOpened(false)} onLoaded={onLoaded} />;
  }

  return (
    <div className="h-full overflow-auto">
      <ul>
        {history.revisions?.map((item) => (
          <li key={item.sha}>
            <button
              type="button"
              onClick={() => {
                history.select(item);
                setOpened(true);
              }}
              className="block w-full border-border border-b px-4 py-3 text-start hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="block truncate font-medium">{item.subject || "Untitled commit"}</span>
              <span className="mt-0.5 flex gap-2 text-muted-foreground text-xs">
                <span className="truncate">{authorsOf(item)}</span>
                <span className="ms-auto shrink-0">
                  <time dateTime={item.authoredAt}>{dateLabel(item.authoredAt)}</time> · {item.sha.slice(0, 7)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {history.loading && (
        <p role="status" className="px-4 py-3 text-muted-foreground">
          Loading history…
        </p>
      )}
      {history.error && (
        <p role="alert" className="px-4 py-3 text-destructive">
          {history.error}
        </p>
      )}
      {!history.loading && (history.error || history.hasMore) && (
        <Button variant="ghost" size="sm" className="m-2" onClick={history.loadMore}>
          {history.error ? "Retry" : "Load older"}
        </Button>
      )}
      {history.revisions?.length === 0 && <p className="px-4 py-3">No committed versions at this path yet.</p>}
      {history.revisions && (
        <p className="px-4 py-3 text-muted-foreground text-xs">
          Versions from before a move may be under the previous path.
        </p>
      )}
    </div>
  );
}

type RevisionProps = {
  history: ReturnType<typeof usePageHistory>;
  onBack(): void;
  onLoaded(): void;
};

/** One committed version: its changes or its Markdown, and the way to load it as a draft. */
function Revision({ history, onBack, onLoaded }: RevisionProps) {
  const { generated } = useDocTarget();
  const { editable } = useLiveEditConfig();
  const page = useInplace();
  const [view, setView] = useState<"diff" | "source">("diff");
  const loading = useMutation({
    mutationFn: loadAsDraft,
    onSuccess: (replaced) => {
      if (replaced) onLoaded();
    },
  });

  const { selected, revision, current } = history;
  const text = revision?.text;
  const reason = generated
    ? "Code owns this page, so it cannot be loaded into the editor."
    : !editable || !page
      ? "Editing is unavailable on this deployment."
      : text === null
        ? "This file does not exist at this commit."
        : null;

  const error = loading.isError
    ? "This version could not be loaded into the editor. Your existing draft is unchanged."
    : null;

  function loadDraft() {
    if (!page || reason || typeof text !== "string" || loading.isPending) return;
    loading.mutate({ page, text });
  }

  if (!selected) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-border border-b px-2 py-2">
        <Button variant="ghost" size="icon-sm" aria-label="All versions" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{selected.subject || "Untitled commit"}</p>
          <p className="text-muted-foreground text-xs">
            {dateLabel(selected.authoredAt)} · {selected.sha.slice(0, 7)}
          </p>
        </div>
        <fieldset className="flex gap-1" aria-label="Version display">
          <Button
            size="sm"
            variant={view === "diff" ? "secondary" : "ghost"}
            aria-pressed={view === "diff"}
            onClick={() => setView("diff")}
          >
            Changes
          </Button>
          <Button
            size="sm"
            variant={view === "source" ? "secondary" : "ghost"}
            aria-pressed={view === "source"}
            onClick={() => setView("source")}
          >
            Markdown
          </Button>
        </fieldset>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {history.revisionError && (
          <div className="space-y-2 p-4">
            <p role="alert">{history.revisionError}</p>
            <Button variant="outline" size="sm" onClick={history.retryRevision}>
              Retry
            </Button>
          </div>
        )}
        {text === undefined && !history.revisionError && (
          <p role="status" className="p-4 text-muted-foreground">
            Loading version…
          </p>
        )}
        {text === null && <p className="p-4">The file is absent at this commit. It may have been deleted or moved.</p>}
        {typeof text === "string" &&
          (view === "source" ? (
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">{text || "Empty file"}</pre>
          ) : (
            current && <RevisionDiff current={current.text} selected={text} />
          ))}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-border border-t p-3">
        <p
          className={error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
          role={error ? "alert" : undefined}
        >
          {error ?? reason ?? "Loads as a draft. Nothing is saved yet."}
        </p>
        <Button
          size="sm"
          disabled={Boolean(reason) || loading.isPending || typeof text !== "string"}
          onClick={loadDraft}
        >
          {loading.isPending ? "Loading…" : "Load into editor"}
        </Button>
      </footer>
    </div>
  );
}

/**
 * Replaces the page's draft with a version's text, once it parses and the reader agrees.
 *
 * Asks first when the browser already holds edits or conflicts for the page.
 * Answers whether the draft was replaced, so a reader who declines stays put.
 *
 * @example await loadAsDraft({ page, text: revision.text }); // true
 */
async function loadAsDraft({ page, text }: { page: Inplace; text: string }) {
  const { parseMarkdown } = await import("../markdown/pipeline");
  parseMarkdown(text);
  await page.recovery.start();
  const changed =
    page.draft.edits().size > 0 || page.draft.replacement() !== null || page.recovery.get().conflicts.length > 0;
  const replacing =
    !changed ||
    (await confirmInPage({
      title: "Replace your unsaved edits?",
      description: "This version takes their place in the editor. Nothing is saved yet.",
      confirm: "Replace",
    }));
  if (!replacing) return false;
  page.recovery.replace(text);
  return true;
}

/** Everyone who wrote a version, by name. */
function authorsOf(revision: PageRevision) {
  return revision.authors.map((author) => author.name).join(", ");
}

/** Formats valid commit dates without failing on missing author metadata. */
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
