/**
 * Whole blocks picked out of the page, as one selection.
 *
 * A selection inside one block is that block's editor's business, and it is
 * text: half a sentence can be copied. The moment a selection reaches a second
 * block it stops being text and becomes this, a run of whole blocks, which is
 * what copying, cutting, deleting, indenting and dragging then act on.
 *
 * A run is always siblings. Dragging from a paragraph inside a callout down to
 * the paragraph under the callout selects the callout and that paragraph, not
 * half a callout, because half a callout is not something a page can hold.
 *
 * Nothing here knows what an editor is, so the page's provider can hold one
 * from its first render without downloading one.
 */

import type { BlockOps, Handles } from "./handles";
import { blockBounds } from "./handleGeometry";
import type { Direction } from "./roster";

export type BlockSelection = {
  /** The selected blocks, top to bottom, or an empty list when nothing is selected. */
  get(): readonly BlockOps[];
  /** Where the run was started, which Shift extends away from. */
  anchor(): BlockOps | null;
  /** Selects every sibling from `anchor` to `head`, or `anchor` alone. */
  select(anchor: BlockOps, head?: BlockOps): void;
  /** Moves the run's moving end one block up or down, keeping its anchor, and out of a box at its edge. */
  extend(direction: Direction): void;
  /** Selects the one block just past the run's edge, or keeps the edge when there is none. */
  step(direction: Direction): void;
  /** Selects every block of the article. */
  all(): void;
  clear(): void;
  subscribe(fn: () => void): () => void;
};

const NOTHING: readonly BlockOps[] = [];

/**
 * An empty selection over the page's registered blocks.
 *
 * @example const blocks = createBlockSelection(page.handles); blocks.select(first, last);
 */
export function createBlockSelection(handles: Handles): BlockSelection {
  let anchor: BlockOps | null = null;
  let head: BlockOps | null = null;
  let selected = NOTHING;
  const subscribers = new Set<() => void>();

  const set = (from: BlockOps | null, to: BlockOps | null) => {
    if (from === anchor && to === head) return;

    anchor = from;
    head = to;
    selected = from === null || to === null ? NOTHING : span(handles, from, to);
    subscribers.forEach((fn) => fn());
  };

  return {
    get: () => selected,
    anchor: () => anchor,

    select(from, to = from) {
      set(from, to);
    },

    extend(direction) {
      if (anchor === null || head === null) return;

      const siblings = siblingsOf(handles, head);
      const next = siblings[siblings.indexOf(head) + direction] ?? parentOf(handles, head);
      if (next !== null) set(anchor, next);
    },

    step(direction) {
      const edge = direction === -1 ? selected[0] : selected.at(-1);
      if (edge === undefined) return;

      const siblings = siblingsOf(handles, edge);
      const next = siblings[siblings.indexOf(edge) + direction] ?? edge;
      set(next, next);
    },

    all() {
      const article = siblingsOf(handles, null);
      const [first] = article;
      if (first !== undefined) set(first, article.at(-1) ?? first);
    },

    clear() {
      set(null, null);
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/**
 * The registered block an element stands inside, however deep, or null for none.
 *
 * @example blockOf(page.handles, caretElement); // the paragraph's ops
 */
export function blockOf(handles: Handles, element: Element | null): BlockOps | null {
  for (let at = element; at !== null; at = at.parentElement) {
    const ops = handles.at(at);
    if (ops !== null) return ops;
  }

  return null;
}

/**
 * The block a reader means by the one they are in, which climbs out of any box it fills alone.
 *
 * A callout of two paragraphs is two blocks to pick from, but a quote holding
 * one paragraph is one block to anybody looking at it, and picking the
 * paragraph inside it would leave an empty quote behind a Delete.
 *
 * @example meant(page.handles, onlyParagraphOfQuote); // the quote's ops
 */
export function meant(handles: Handles, ops: BlockOps): BlockOps {
  let here = ops;
  for (let parent = parentOf(handles, here); parent !== null; parent = parentOf(handles, parent)) {
    if (childrenOf(handles, parent).length > 1) break;
    here = parent;
  }

  return here;
}

/**
 * The registered block this one stands inside, a callout around its paragraph, or null in the article.
 *
 * @example parentOf(page.handles, paragraphInCallout); // the callout's ops
 */
export function parentOf(handles: Handles, ops: BlockOps): BlockOps | null {
  return blockOf(handles, ops.dom.parentElement);
}

/**
 * Every block on screen with the same parent as this one, top to bottom.
 *
 * @example siblingsOf(page.handles, paragraph); // the paragraph and the blocks beside it
 * @example siblingsOf(page.handles, null); // every block of the article
 */
export function siblingsOf(handles: Handles, ops: BlockOps | null): BlockOps[] {
  return childrenOf(handles, ops === null ? null : parentOf(handles, ops));
}

/**
 * Every block on screen standing directly inside this one, top to bottom, or the article's own for null.
 *
 * A block a reader deleted keeps its registration, hidden, so an undo can bring
 * it back. It has no box, and so it is nobody's child.
 *
 * @example childrenOf(page.handles, callout); // the callout's paragraphs
 */
export function childrenOf(handles: Handles, parent: BlockOps | null): BlockOps[] {
  return handles
    .all()
    .filter((one) => standing(one) && parentOf(handles, one) === parent)
    .sort(byPage);
}

/**
 * Whether a registered block is on the page and drawn, rather than deleted and waiting for an undo.
 *
 * @example standing(ops); // false for a block a reader just deleted
 */
export function standing(ops: BlockOps): boolean {
  if (!ops.dom.isConnected) return false;

  const box = blockBounds(ops.box);
  return box.width > 0 || box.height > 0;
}

/**
 * The run of siblings between two blocks, at the deepest level both can share.
 *
 * Each end climbs out of whatever it stands inside until the two ends have the
 * same parent, so a run from inside a callout to the article below it starts
 * at the callout itself.
 *
 * @example span(handles, paragraphInCallout, paragraphBelow); // [callout, …, paragraphBelow]
 */
function span(handles: Handles, anchor: BlockOps, head: BlockOps): readonly BlockOps[] {
  const above = lineage(handles, head);

  for (const from of lineage(handles, anchor)) {
    const parent = parentOf(handles, from);
    const to = above.find((one) => parentOf(handles, one) === parent);
    if (to === undefined) continue;

    const siblings = siblingsOf(handles, from);
    const ends = [siblings.indexOf(from), siblings.indexOf(to)];
    const start = Math.min(...ends);
    const end = Math.max(...ends);
    return start === -1 ? [from] : siblings.slice(start, end + 1);
  }

  return [anchor];
}

/** A block and every registered block it stands inside, innermost first. */
function lineage(handles: Handles, ops: BlockOps): BlockOps[] {
  const chain = [ops];
  for (let parent = parentOf(handles, ops); parent !== null; parent = parentOf(handles, parent)) chain.push(parent);
  return chain;
}

/** `Node.DOCUMENT_POSITION_FOLLOWING`, by value, so this module needs no DOM globals. */
const FOLLOWING = 4;

function byPage(a: BlockOps, b: BlockOps): number {
  return a.dom.compareDocumentPosition(b.dom) & FOLLOWING ? -1 : 1;
}
