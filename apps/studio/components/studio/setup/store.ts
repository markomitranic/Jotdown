"use client";

import { useSyncExternalStore } from "react";
import type { SetupTarget } from "@/lib/setup";

/**
 * Whether the setup wizard is open, and the repository or folder it was opened for.
 *
 * Anything in the studio opens it, the switcher, the welcome page, a project
 * with no docs yet, and one wizard answers wherever the studio mounts it. Each
 * opening is counted, so the wizard starts over rather than where it was left.
 */

export type SetupRequest = { open: boolean; start: SetupTarget | null; opening: number };

let request: SetupRequest = { open: false, start: null, opening: 0 };
const listeners = new Set<() => void>();

/**
 * Opens the wizard, on a repository or folder when one is named.
 *
 * @example openSetup({ kind: "github", key: "you/site" });
 */
export function openSetup(start: SetupTarget | null = null) {
  request = { open: true, start, opening: request.opening + 1 };
  changed();
}

/** Closes the wizard. */
export function closeSetup() {
  request = { ...request, open: false };
  changed();
}

/**
 * The wizard's request as it stands.
 *
 * @example const { open, start, opening } = useSetupRequest();
 */
export function useSetupRequest() {
  return useSyncExternalStore(
    subscribe,
    () => request,
    () => request,
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}
