"use client";

/**
 * Which pages this browser is holding changes for, and where they are kept.
 *
 * A draft lives in the browser until somebody saves it, which means a reader
 * can leave a page mid-sentence, read three others, and have no way of knowing
 * the first one is still waiting. The page itself says so through its toolbar;
 * nothing else did.
 *
 * The answer cannot come from the draft, because a page nobody is on has no
 * draft in memory: it has a recovery copy in storage and nothing else. So this
 * reads storage, which is also why it is one key per page rather than one
 * record of every page. A key is written by the page that owns it, and a page
 * left open in another tab writing its own key is a `storage` event here.
 *
 * **One store, not one per row.** Every row of the sidebar asks this question,
 * and the sidebar has as many rows as the site has pages. A hook that read
 * storage on its own would walk every key in it once per row per keystroke, and
 * hand back a new `Set` each time so that no row could ever bail out of
 * re-rendering — which is the exact thing the page's draft is kept outside
 * React state to avoid. So the walk happens once per event, the answer is
 * cached, and a walk that finds nothing new tells nobody.
 *
 * Nothing is read on the server or on the first render, so the sidebar the
 * build wrote and the sidebar React hydrates are the same one, and the marks
 * appear immediately after.
 */

import { useCallback, useSyncExternalStore } from "react";
import { useLiveEditConfig } from "../client/config";
import { docUrl } from "@jotdown/core/lib/paths";

/** Announced on this window whenever a page writes or clears its own copy. */
export const RECOVERY_CHANGED = "live-edit:recovery-changed";

const KEYS = "live-edit:recovery:";

/**
 * Where one page's recovery copy is kept.
 *
 * @example recoveryKey("/api/live-edit:docs/index.mdx"); // "live-edit:recovery:/api/live-edit:docs/index.mdx"
 */
export function recoveryKey(page: string) {
  return `${KEYS}${page}`;
}

/**
 * Tells this window that a page's copy changed, where there is a window to tell.
 *
 * Storage fires its own event in every tab but the one that wrote, so the tab
 * doing the writing has to tell itself. The guard is for the server and for the
 * tests, neither of which has a window and neither of which has a sidebar on
 * screen to hear it.
 */
export function announceRecovery() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECOVERY_CHANGED));
}

const NONE: ReadonlySet<string> = new Set();

/** The URL of every page with a recovery copy in this browser, under the project's base. */
function unsavedUrls({ apiBase, base }: Scope): ReadonlySet<string> {
  const prefix = recoveryKey(`${apiBase}:`);
  const urls = new Set<string>();

  try {
    for (let at = 0; at < localStorage.length; at += 1) {
      const key = localStorage.key(at);
      if (key?.startsWith(prefix)) urls.add(docUrl(key.slice(prefix.length), base));
    }
  } catch {
    return NONE;
  }

  return urls;
}

const same = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((url) => b.has(url));

let known = NONE;
type Scope = { apiBase: string; base: string };

let scope: Scope | null = null;
let attached: (() => void) | null = null;
const listeners = new Set<() => void>();

/**
 * Re-reads storage and tells the rows, but only when the answer moved.
 *
 * Holding the last answer is what lets a row bail out: the same `Set` back
 * means React has nothing to do, and typing changes this answer once, on the
 * keystroke that first made the page dirty.
 */
function reread() {
  if (scope === null) return;

  const found = unsavedUrls(scope);
  if (same(known, found)) return;

  known = found;
  listeners.forEach((tell) => tell());
}

/**
 * Adds one row to the store, attaching the window listeners for the first.
 *
 * The listener is held at module level rather than made per subscriber,
 * because a different closure per row would mean every row but the first
 * removing something that was never added.
 */
function watch(watched: Scope, tell: () => void) {
  scope = watched;

  if (attached === null) {
    attached = reread;
    window.addEventListener("storage", attached);
    window.addEventListener(RECOVERY_CHANGED, attached);
  }

  listeners.add(tell);
  reread();

  return () => {
    listeners.delete(tell);
    if (listeners.size > 0 || attached === null) return;

    window.removeEventListener("storage", attached);
    window.removeEventListener(RECOVERY_CHANGED, attached);
    attached = null;
  };
}

/**
 * The pages with changes waiting on them, as the URLs the sidebar knows them by.
 *
 * @example const unsaved = useUnsaved(); unsaved.has("/manual/edit-locks");
 */
export function useUnsaved(): ReadonlySet<string> {
  const { apiBase, base } = useLiveEditConfig();
  const subscribe = useCallback((tell: () => void) => watch({ apiBase, base }, tell), [apiBase, base]);

  return useSyncExternalStore(
    subscribe,
    () => known,
    () => NONE,
  );
}
