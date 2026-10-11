"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronRight, LoaderCircle, Undo2 } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { COLOUR } from "@jotdown/core/lib/theme";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import type { PageHistoryResponse, PageRevision, PageRevisionResponse } from "@jotdown/editor/types";
import { useDraft } from "./draft";
import { changedPaths, valueAt } from "@/lib/settings/config-draft";
import { SettingsBlock, SettingsGroup } from "./parts";

/**
 * Every commit that changed the config, newest first, each one able to come back as the draft.
 *
 * A version opens on what restoring it would change in the draft, field by
 * field, and restoring puts the whole file back into the draft, where it can be
 * looked over and saved like any other change.
 *
 * @example <HistorySection />
 */
export function HistorySection() {
  const { projectId } = useDraft();
  const [opened, setOpened] = useState<string | null>(null);

  const history = useInfiniteQuery({
    queryKey: ["settings", projectId, "history"],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({
        page: String(pageParam.page),
        ...(pageParam.head && { head: pageParam.head }),
      });
      return fetchJson<PageHistoryResponse>(`/api/projects/${projectId}/settings/history?${query}`);
    },
    initialPageParam: { page: 1, head: "" },
    getNextPageParam: (last) => (last.nextPage ? { page: last.nextPage, head: last.head } : undefined),
  });

  const revisions = history.data?.pages.flatMap((page) => page.revisions) ?? [];

  return (
    <SettingsGroup title="Versions of the config">
      <SettingsBlock keywords="history versions revert restore undo commits">
        {history.isPending && (
          <p className="flex items-center gap-2 px-4 py-6 text-muted-foreground text-sm">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Reading the history…
          </p>
        )}
        {history.isError && <p className="px-4 py-6 text-destructive text-sm">{history.error.message}</p>}
        {history.isSuccess && revisions.length === 0 && (
          <p className="px-4 py-6 text-muted-foreground text-sm">
            No commits yet. A folder outside git, or a config nobody has committed, has no history to show.
          </p>
        )}
        <ul className="divide-y divide-border">
          {revisions.map((revision, index) => (
            <Version
              key={revision.sha}
              revision={revision}
              latest={index === 0}
              open={opened === revision.sha}
              onToggle={() => setOpened((current) => (current === revision.sha ? null : revision.sha))}
            />
          ))}
        </ul>
        {history.hasNextPage && (
          <div className="border-border border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={history.isFetchingNextPage}
              onClick={() => history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "Loading…" : "Load older versions"}
            </Button>
          </div>
        )}
      </SettingsBlock>
    </SettingsGroup>
  );
}

type VersionProps = { revision: PageRevision; latest: boolean; open: boolean; onToggle: () => void };

function Version({ revision, latest, open, onToggle }: VersionProps) {
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-start outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-sm">{revision.subject || "Untitled commit"}</span>
            {latest && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[0.625rem] text-muted-foreground">
                Latest
              </span>
            )}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {revision.authors.map((author) => author.name).join(", ")} · {when(revision.authoredAt)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-muted-foreground text-xs">{revision.sha.slice(0, 7)}</span>
      </button>
      {open && <Restore sha={revision.sha} />}
    </li>
  );
}

/** What restoring one version would change in the draft, and the button that does it. */
function Restore({ sha }: { sha: string }) {
  const { projectId, config, setText } = useDraft();
  const revision = useQuery({
    queryKey: ["settings", projectId, "revision", sha],
    queryFn: () => fetchJson<PageRevisionResponse>(`/api/projects/${projectId}/settings/revision?sha=${sha}`),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const text = revision.data?.text;
  const then = text ? parseObject(text) : null;
  const changes = then && config ? changedPaths(config, then) : [];

  return (
    <div className="flex flex-col gap-3 bg-background/60 px-4 ps-10.5 pt-1 pb-4">
      {revision.isPending && <p className="text-muted-foreground text-xs">Reading this version…</p>}
      {revision.isError && <p className="text-destructive text-xs">{revision.error.message}</p>}
      {revision.isSuccess && text === null && (
        <p className="text-muted-foreground text-xs">The config did not exist yet.</p>
      )}
      {text && !then && (
        <p className="text-muted-foreground text-xs">This version is not valid JSON, so it cannot be restored.</p>
      )}
      {then && changes.length === 0 && (
        <p className="text-muted-foreground text-xs">The draft already matches this version.</p>
      )}
      {then && changes.length > 0 && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {changes.slice(0, 24).map((path) => (
              <Change key={path} path={path} now={valueAt(config, path)} then={valueAt(then, path)} />
            ))}
          </dl>
          {changes.length > 24 && <p className="text-muted-foreground text-xs">And {changes.length - 24} more.</p>}
          <div>
            <Button size="sm" variant="outline" onClick={() => setText(text ?? "")}>
              <Undo2 aria-hidden="true" />
              Restore into the draft
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Change({ path, now, then }: { path: string; now: unknown; then: unknown }) {
  return (
    <>
      <dt className="font-mono text-muted-foreground">{path}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <Value value={now} />
        <span className="text-muted-foreground">→</span>
        <Value value={then} />
      </dd>
    </>
  );
}

/** A config value drawn short: a colour with its swatch, a group of settings as how many, a missing one as none. */
function Value({ value }: { value: unknown }) {
  if (value === undefined) return <span className="text-muted-foreground">none</span>;
  if (typeof value === "object" && value !== null) {
    const count = changedPaths({}, value).length;
    return <span className="text-muted-foreground">{count === 1 ? "1 setting" : `${count} settings`}</span>;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);

  return (
    <span className="flex min-w-0 items-center gap-1">
      {typeof value === "string" && COLOUR.test(value) && (
        <span className="size-3 shrink-0 rounded-sm ring-1 ring-foreground/15" style={{ background: value }} />
      )}
      <span className="truncate font-mono">{text}</span>
    </span>
  );
}

function parseObject(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A commit's date as a person would say it, relative while it is recent.
 *
 * @example when("2026-10-11T09:00:00Z"); // "3 hours ago"
 */
function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown date";

  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 24) return relative.format(Math.round(minutes / 60), "hour");
  if (Math.abs(minutes) < 60 * 24 * 7) return relative.format(Math.round(minutes / 1440), "day");
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}
