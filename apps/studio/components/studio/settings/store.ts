"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the project settings are open, and on which section.
 *
 * The gear in the status strip and ⌘, both open the same panel, and the status
 * strip marks the gear while it is open, so its state lives here rather than in
 * either of them.
 */

export const SECTIONS = ["general", "identity", "theme", "history", "file"] as const;

export type Section = (typeof SECTIONS)[number];

export type SettingsState = { open: boolean; section: Section };

let state: SettingsState = { open: false, section: "general" };
const listeners = new Set<() => void>();

/**
 * Opens the settings, on a section when one is named, or where they were left.
 *
 * @example openSettings("theme");
 */
export function openSettings(section?: Section) {
  state = { open: true, section: section ?? state.section };
  changed();
}

/** Closes the settings, keeping the section for next time. */
export function closeSettings() {
  state = { ...state, open: false };
  changed();
}

/** Opens the settings when they are closed, and closes them when they are open. */
export function toggleSettings() {
  if (state.open) closeSettings();
  else openSettings();
}

/** Moves to another section of the open settings. */
export function showSection(section: Section) {
  state = { ...state, section };
  changed();
}

/**
 * The settings as they stand.
 *
 * @example const { open, section } = useSettings();
 */
export function useSettings() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}
