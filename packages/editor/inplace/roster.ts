/**
 * Every editor mounted on the page, in the order the reader sees them.
 *
 * A block is its own little document with nothing above or beside it, so
 * pressing Down on the last line, or Backspace on the first character, asks a
 * question the block cannot answer on its own. The roster is the answer: it
 * holds the mounted editors and tells one which one comes next.
 *
 * Order is the DOM's, not the file's. A callout's label and its body are two
 * editors under one stamp and the DOM already knows which is first, a block
 * that Enter created has no stamp at all, and what the reader sees is the order
 * they expect the caret to walk in.
 *
 * A block the editor cannot draw, a code fence or a table, never joins, so the
 * caret steps over it rather than into it.
 */

import type { JSONContent } from "@tiptap/core";

/** One mounted editor, as everything outside the editor sees it. */
export type Mounted = {
  /** The element the editor took over, which is what fixes its place on the page. */
  dom: HTMLElement;
  /** Puts the caret on this edge, as near this screen x as the line reaches. */
  enter(edge: "start" | "end", x: number | null): void;
  /** Takes inline content onto the end, and reports whether it could. */
  absorb(content: JSONContent[]): boolean;
};

export type Roster = {
  /** Adds an editor, and returns the leaving. */
  join(mounted: Mounted): () => void;
  /** The nearest editor before (-1) or after (1) the given element, if there is one. */
  beside(dom: HTMLElement, direction: Direction): Mounted | null;
  /** The editor drawn nearest this window y, for a click that landed between blocks. */
  nearest(y: number): Mounted | null;
};

export type Direction = -1 | 1;

/** @example const roster = createRoster(); const leave = roster.join(mounted); */
export function createRoster(): Roster {
  const everyone = new Set<Mounted>();

  return {
    join(mounted) {
      everyone.add(mounted);
      return () => everyone.delete(mounted);
    },

    beside(dom, direction) {
      let nearest: Mounted | null = null;

      for (const candidate of everyone) {
        if (candidate.dom === dom || order(dom, candidate.dom) !== direction) continue;
        if (nearest === null || order(candidate.dom, nearest.dom) === direction) {
          nearest = candidate;
        }
      }

      return nearest;
    },

    nearest(y) {
      let closest: { mounted: Mounted; gap: number } | null = null;

      for (const candidate of everyone) {
        if (!candidate.dom.isConnected) continue;

        const box = candidate.dom.getBoundingClientRect();
        if (box.height === 0) continue;

        const gap = y < box.top ? box.top - y : Math.max(y - box.bottom, 0);
        if (closest === null || gap < closest.gap) closest = { mounted: candidate, gap };
      }

      return closest?.mounted ?? null;
    },
  };
}

/**
 * `Node.DOCUMENT_POSITION_FOLLOWING` and `_PRECEDING`, by value.
 *
 * Naming them here is what keeps this module free of DOM globals, so it can be
 * read by anything that can answer `compareDocumentPosition`.
 */
const FOLLOWING = 4;
const PRECEDING = 2;

/** Where `b` sits relative to `a`: 1 after, -1 before, 0 when neither, as a detached node is. */
function order(a: HTMLElement, b: HTMLElement): Direction | 0 {
  const how = a.compareDocumentPosition(b);
  if (how & FOLLOWING) return 1;
  if (how & PRECEDING) return -1;
  return 0;
}
