"use client";

import { useSyncExternalStore } from "react";

/** One line the status strip shows for a moment: what a tool just did, or why it could not. */
export type Note = { text: string; tone: "done" | "failed"; at: number };

/** How long a note stays before it fades. */
const SHOWN_MS = 4000;

/** Every status strip item draws its buttons alike, a quiet row of text and icons that light up under the pointer. */
export const ITEM =
  "flex h-5.5 shrink-0 items-center gap-1.5 rounded px-1.5 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-accent-foreground disabled:pointer-events-none";

const listeners = new Set<() => void>();
let current: Note | null = null;
let fading: ReturnType<typeof setTimeout> | undefined;

/**
 * Shows a line in the status strip for a few seconds, replacing whatever it said before.
 *
 * @example note("Opened in VS Code");
 * @example note("VS Code is not in Applications.", "failed");
 */
export function note(text: string, tone: Note["tone"] = "done") {
  clearTimeout(fading);
  current = { text, tone, at: Date.now() };
  announce();
  fading = setTimeout(() => {
    current = null;
    announce();
  }, SHOWN_MS);
}

/**
 * The line the status strip shows now, or null.
 *
 * @example const shown = useNote(); shown?.text; // "Up to date"
 */
export function useNote() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

function announce() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
