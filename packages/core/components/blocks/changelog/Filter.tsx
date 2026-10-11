"use client";

import { useEffect, useMemo, useState } from "react";
import { releaseId, written } from "@jotdown/core/lib/changelog";

/** One release as the filter sees it: the element the server drew, and what can be matched against. */
type Release = {
  element: HTMLElement;
  version: string;
  /** `YYYY-MM-DD`, which is what the two date inputs compare against. */
  date: string;
  /** The release's own words, lowercased, which is what the search box looks in. */
  words: string;
};

/**
 * The search box, date range and release picker above a changelog.
 *
 * This is the only part of a changelog page that ships as JavaScript. The
 * releases themselves are server-drawn markup, so filtering here is showing
 * and hiding elements rather than rendering them, and the words to match on
 * are read out of the page on mount rather than sent along with it.
 *
 * `total` is the count the server already knew, so the line under the filters
 * reads correctly on the first paint, before the effect below has found
 * anything to filter.
 */
export function ChangelogFilter({ list, total }: { list: string; total: number }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /** Reads the releases the server drew, once, so the filters have something to work on. */
  useEffect(() => {
    const drawn = document.getElementById(list)?.querySelectorAll<HTMLElement>("[data-version]");

    setReleases(
      Array.from(drawn ?? [], (element) => ({
        element,
        version: element.dataset.version ?? "",
        date: element.dataset.date ?? "",
        words: `${element.dataset.version} ${element.querySelector("[data-body]")?.textContent ?? ""}`.toLowerCase(),
      })),
    );
  }, [list]);

  const matches = useMemo(
    () => releases.filter((release) => reads(release, query) && within(release, from, to)),
    [releases, query, from, to],
  );

  /** Applies the filters to the markup, which for a release means being drawn or not. */
  useEffect(() => {
    const shown = new Set(matches);

    for (const release of releases) release.element.hidden = !shown.has(release);
  }, [releases, matches]);

  /**
   * Scrolls to a release the picker chose.
   *
   * The picker only offers releases that pass the current filters, so the
   * element is always on the page already and there is nothing to wait for.
   */
  const jumpTo = (version: string) => {
    document.getElementById(releaseId(version))?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${releaseId(version)}`);
  };

  const counted = releases.length === 0 ? total : matches.length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search releases"
          aria-label="Search releases"
          className="min-w-48 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value=""
          onChange={(event) => jumpTo(event.target.value)}
          aria-label="Jump to a release"
          className="max-w-full rounded-md border border-border bg-background px-2 py-1.5 text-1sm text-foreground"
        >
          <option value="" disabled>
            Jump to release…
          </option>
          {matches.map((release) => (
            <option key={release.version} value={release.version}>
              {release.version} · {written(release.date)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Since label="From" value={from} onPick={setFrom} />
        <Since label="To" value={to} onPick={setTo} />
        <p className="m-0 ms-auto text-1sm text-muted-foreground">
          {counted} of {total} releases
        </p>
      </div>

      {releases.length > 0 && matches.length === 0 && (
        <p className="m-0 text-muted-foreground text-sm">No release matches those filters.</p>
      )}
    </div>
  );
}

/**
 * One end of the date range.
 *
 * `color-scheme` is the whole reason this is its own component. Nothing on the
 * site declares one, so Chrome assumes light and draws the calendar glyph
 * inside a date input near-black, which is invisible on the dark ground. The
 * property is what native controls actually read; `filter` on
 * `::-webkit-calendar-picker-indicator` looks like it should work and does not
 * reach the shadow pseudo-element at all.
 */
function Since({ label, value, onPick }: { label: string; value: string; onPick: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-1sm text-muted-foreground">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onPick(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-1sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
      />
    </label>
  );
}

/** True when the search box is empty or its words appear in the release. */
function reads(release: Release, query: string) {
  const needle = query.trim().toLowerCase();

  return needle.length === 0 || release.words.includes(needle);
}

/** True when the release's date sits inside the chosen range, either end of which may be open. */
function within(release: Release, from: string, to: string) {
  return (from === "" || release.date >= from) && (to === "" || release.date <= to);
}
