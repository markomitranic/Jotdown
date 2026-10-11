/**
 * What the reader has changed on this page, and nothing else.
 *
 * A draft is a set of replacement strings keyed by the stamp of the block they
 * replace. A whole-page replacement becomes the source those slices refer to.
 * It holds slices rather than pointers: the ranges are read once, off
 * the page the reader is looking at, so nothing here has to be recomputed when
 * an earlier block gets longer or shorter.
 *
 * It deliberately lives outside React state. Every editable block on the page
 * writes to it, and a store that rerendered the tree on each keystroke would
 * rerender the very elements ProseMirror has taken over.
 */

import { rangeIn } from "@jotdown/core/lib/source-range";

type Listener = (change: "write" | "clear" | "replace") => void;

export type Draft = {
  /** Replaces the whole page locally and forgets edits against the previous text. */
  replace(markdown: string): void;
  /** Historical source underlying block edits, or null for the deployed source. */
  replacement(): string | null;
  /** Changes only when the page needs its block editors remounted. */
  revision(): number;
  /** Records a block's new markdown, or forgets it when the block is back to how it was. */
  write(stamp: string, markdown: string | null): void;
  /** Every changed block, keyed by stamp. */
  edits(): ReadonlyMap<string, string>;
  /** Forgets every change at once, which is where a landed save leaves the page. */
  clear(): void;
  /** Calls back whenever the set of changes changes. Returns the unsubscribe. */
  subscribe(listener: Listener): () => void;
};

/** Tracks block edits and optional replacement source without rerendering on each keystroke.
 * @example const draft = createDraft(); draft.write("5:1-5:9", "Hello.");
 */
export function createDraft(): Draft {
  let replacement: string | null = null;
  let revision = 0;
  const edits = new Map<string, string>();
  const listeners = new Set<Listener>();

  return {
    replace(markdown) {
      edits.clear();
      replacement = markdown;
      revision += 1;
      for (const listener of listeners) listener("replace");
    },

    replacement: () => replacement,
    revision: () => revision,

    write(stamp, markdown) {
      const had = edits.get(stamp);
      if (had === markdown || (markdown === null && had === undefined)) return;

      if (markdown === null) edits.delete(stamp);
      else edits.set(stamp, markdown);

      for (const listener of listeners) listener("write");
    },

    edits: () => edits,

    clear() {
      if (edits.size === 0 && replacement === null) return;
      if (replacement !== null) revision += 1;
      replacement = null;
      edits.clear();
      for (const listener of listeners) listener("clear");
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * The file as the draft would write it: the original text with changed blocks spliced in.
 *
 * Stamps that no longer cut a range out of this text are skipped rather than
 * guessed at, which is what keeps a draft written against one deployment from
 * corrupting a file that has moved on since.
 *
 * An empty replacement is a block the reader merged into the one above, and it
 * takes the blank line that separated them with it. Splicing nothing in and
 * leaving the separators alone would pile up blank lines at the top of a file
 * or between two paragraphs that are now neighbours.
 *
 * @example applyDraft("# Hi\n\nOld.\n", new Map([["3:1-3:5", "New."]])); // "# Hi\n\nNew.\n"
 * @example applyDraft("A.\n\nB.\n", new Map([["1:1-1:3", ""]])); // "B.\n"
 */
export function applyDraft(source: string, edits: ReadonlyMap<string, string>): string {
  const patches = [...edits]
    .map(([stamp, markdown]) => ({ range: rangeIn(source, stamp), markdown }))
    .filter((patch): patch is { range: { start: number; end: number }; markdown: string } => patch.range !== null)
    .sort((a, b) => a.range.start - b.range.start || b.range.end - a.range.end);

  let written = "";
  let at = 0;

  for (const { range, markdown } of patches) {
    if (range.start < at) continue;
    written += source.slice(at, range.start);

    if (markdown !== "") {
      written += markdown;
      at = range.end;
      continue;
    }

    const rest = source.slice(range.end);
    const separator = SEPARATOR.exec(rest);

    if (separator === null) written = written.replace(BLANK_TAIL, "\n");
    at = range.end + (separator?.[0] ?? WHITESPACE.exec(rest)?.[0] ?? "").length;
  }

  return written + source.slice(at);
}

/** The blank line between two blocks, read forward from the end of the first. */
const SEPARATOR = /^[ \t]*\n(?:[ \t]*\n)+/;

/** Every blank line already written, for a block that had no block after it. */
const BLANK_TAIL = /(?:[ \t]*\n)+$/;

const WHITESPACE = /^[ \t\n]*/;
