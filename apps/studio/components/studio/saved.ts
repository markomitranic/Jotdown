"use client";

import { useSyncExternalStore } from "react";
import type { Bookmark } from "./projects";

const answeredBookmarks = storedList<Bookmark>("studio-answered-bookmarks");

/**
 * GitHub's last answer for the bookmarks, kept so the next page load lists them before GitHub answers again.
 *
 * Empty on the server, through hydration, and in a browser that was never answered.
 *
 * @example const answered = useAnsweredBookmarks(); // [{ key: "grace/talks", locked: false, … }]
 */
export function useAnsweredBookmarks() {
  return answeredBookmarks.use();
}

/**
 * Keeps GitHub's answer for the bookmarks until the next one.
 *
 * @example rememberAnsweredBookmarks(bookmarks);
 */
export function rememberAnsweredBookmarks(bookmarks: Bookmark[]) {
  answeredBookmarks.write(bookmarks);
}

/**
 * A list of `{ key, title }` records kept in this browser's storage, shared by every tab, the same array until it changes.
 *
 * @example const projects = storedList<SavedProject>("studio-saved-projects"); projects.read(); // []
 */
function storedList<Item extends { key: string; title: string }>(storageKey: string) {
  const none: Item[] = [];
  const listeners = new Set<() => void>();
  let last: { raw: string | null; items: Item[] } = { raw: null, items: none };

  function read() {
    const raw = localStorage.getItem(storageKey);
    if (raw !== last.raw) last = { raw, items: parse(raw) };
    return last.items;
  }

  function parse(raw: string | null): Item[] {
    try {
      const items = JSON.parse(raw ?? "[]");
      return Array.isArray(items)
        ? items.filter((item) => typeof item?.key === "string" && typeof item?.title === "string")
        : none;
    } catch {
      return none;
    }
  }

  function write(items: Item[]) {
    localStorage.setItem(storageKey, JSON.stringify(items));
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  }

  return {
    read,
    write,
    use: () => useSyncExternalStore(subscribe, read, () => none),
  };
}
