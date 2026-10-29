"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the page is drawn as its readers get it, with the editor taken off.
 *
 * Unsaved writing is kept in browser storage, so it comes back with the editor.
 */

let reading = false;
const listeners = new Set<() => void>();

/**
 * Switches the page between reading and editing.
 *
 * @example setReading(true);
 */
export function setReading(on: boolean) {
  reading = on;
  for (const listener of listeners) listener();
}

/**
 * Whether the page is drawn for reading.
 *
 * @example const reading = useReading(); // false
 */
export function useReading() {
  return useSyncExternalStore(
    subscribe,
    () => reading,
    () => false,
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
