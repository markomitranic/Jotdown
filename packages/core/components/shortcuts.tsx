"use client";

import { Fragment, useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { cn } from "cn";
import { Kbd, KbdGroup } from "@jotdown/core/components/ui/kbd";

/** One key held with ⌘ on a Mac or Ctrl elsewhere, by its place on the keyboard rather than its letter. */
export type Chord = { code: string; shift?: boolean; alt?: boolean };

/**
 * Every shortcut the shell answers to, each with the chords that trigger it.
 *
 * Keys are matched by `event.code`, so a layout that puts a different letter
 * on the key, or a Shift that changes it, still triggers the same shortcut.
 */
export const SHORTCUTS = {
  sidebar: [{ code: "Digit1" }],
  switcher: [{ code: "Digit2" }, { code: "KeyP", shift: true }],
  pages: [{ code: "KeyP" }],
  drawer: [{ code: "Digit3" }],
  search: [{ code: "KeyK" }, { code: "KeyF", shift: true }],
  settings: [{ code: "Comma" }],
} satisfies Record<string, Chord[]>;

/**
 * Whether a key press is one of the chords, with ⌘ or Ctrl held and nothing else but the Shift or Alt it asks for.
 *
 * @example pressed(new KeyboardEvent("keydown", { code: "Digit1", metaKey: true }), SHORTCUTS.sidebar); // true
 */
export function pressed(event: KeyboardEvent, chords: Chord[]) {
  if (!(event.metaKey || event.ctrlKey)) return false;
  return chords.some(
    (chord) =>
      event.code === chord.code && event.shiftKey === Boolean(chord.shift) && event.altKey === Boolean(chord.alt),
  );
}

/**
 * Runs `handler` whenever one of the chords is pressed anywhere on the page, instead of the browser's own use of it.
 *
 * @example useShortcut(SHORTCUTS.drawer, () => setOpen((open) => !open));
 */
export function useShortcut(chords: Chord[], handler: () => void) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!pressed(event, chords)) return;
    event.preventDefault();
    handler();
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * The modifier as this machine's keyboard names it: ⌘ on a Mac, Ctrl on Windows and Linux.
 *
 * @example const modifier = useModifier(); // "⌘"
 */
export function useModifier() {
  return useSyncExternalStore(
    quiet,
    () => (/Windows|Linux/i.test(navigator.userAgent) ? "Ctrl" : "⌘"),
    () => "⌘",
  );
}

const quiet = () => () => {};

/**
 * A tooltip's text: what the control does, then every chord that does it as key caps.
 *
 * @example <ShortcutHint label="Toggle sidebar" chords={SHORTCUTS.sidebar} />
 */
export function ShortcutHint({ label, chords }: { label: string; chords: Chord[] }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      <ShortcutKeys chords={chords} />
    </span>
  );
}

/**
 * Every chord that does something, as key caps, for a menu row or a tooltip.
 *
 * @example <ShortcutKeys chords={SHORTCUTS.search} /> // ⌘ K
 */
export function ShortcutKeys({ chords, className }: { chords: Chord[]; className?: string }) {
  const modifier = useModifier();

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {chords.map((chord, index) => (
        <Fragment key={chord.code + String(chord.shift)}>
          {index > 0 && <span className="text-muted-foreground">or</span>}
          <KbdGroup>
            <Kbd>{modifier}</Kbd>
            {chord.alt && <Kbd>{modifier === "⌘" ? "⌥" : "Alt"}</Kbd>}
            {chord.shift && <Kbd>⇧</Kbd>}
            <Kbd>{keyName(chord.code)}</Kbd>
          </KbdGroup>
        </Fragment>
      ))}
    </span>
  );
}

/** The letter or digit printed on a key, from its code. @example keyName("Digit1"); // "1" */
function keyName(code: string) {
  return code.replace(/^(Digit|Key)/, "");
}
