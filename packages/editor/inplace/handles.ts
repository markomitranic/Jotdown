/**
 * Every top-level block the reader can grab, duplicate or drop another beside.
 *
 * There is no one document to ask "what are my children" the way the page-wide
 * editor could, because every block here is its own. So a block registers the
 * four things it already knows how to do to itself the moment it stands on the
 * page, keyed by the element the grip finds under the pointer, and a drag is
 * just those four things composed from outside any one block's own closure.
 */

import type { JSONContent } from "@tiptap/core";
import type { History } from "./history";
import type { TurnKind } from "./turn";
import type { BlockWidth } from "@jotdown/core/lib/block-width";

/**
 * A block's own content, portable enough to stand on its own somewhere else.
 *
 * A block the editor cannot draw carries its own markup along with it, because
 * nothing else on the page knows how to make a fence look like Shiki's or a
 * table look like the core's. A copy of it is a copy of that markup, which is
 * why it lands looking exactly like the one it came from.
 */
export type BlockSnapshot = { block: JSONContent; anchor: string; markup?: HTMLElement; width?: BlockWidth };

/** What the block handle can do to whichever block it is pointed at. */
export type BlockOps = {
  /** The element that fixes this block's place on the page, and so where a moved block lands beside it. */
  dom: HTMLElement;
  /** The element with an actual box to measure, where `dom` itself renders nothing. */
  box: HTMLElement;
  /** This block's markdown, exactly as it stands right now, for the clipboard. */
  markdown(): string;
  /** This block's own content, ready to stand on its own elsewhere. */
  snapshot(): BlockSnapshot;
  /**
   * Whether a block arriving from elsewhere can stand here at all.
   *
   * A block of the article can hold anything the file can, except a step,
   * which is nothing outside its `<Steps>`. A block inside a callout is a node in a document with a smaller schema,
   * and one that cannot hold what is being dragged has to say so before the
   * block leaves where it came from.
   */
  accepts?(moved: BlockSnapshot): boolean;
  /** What kind this block is for "Turn into", or null for a block that turns into nothing. */
  kind?(): TurnKind | null;
  /** How wide this block stands, or null for one that only ever stands in the column. */
  width?(): BlockWidth | null;
  /** Stands this block at another width. */
  widen?(width: BlockWidth): void;
  /** Rewrites this block as another kind, carrying its words across. */
  turnInto?(kind: TurnKind): void;
  /** Turns an embed back into the plain link it was pasted as; only an embed has one. */
  unembed?(): void;
  /** Replaces a project block's whole source; only a project block as the file wrote it has one. */
  rewrite?(source: string): void;
  /** Puts a copy of this block directly below it. */
  duplicate(): void;
  /**
   * Takes blocks in as the last of its own, a list into its last item and a box at its end.
   *
   * Reports whether it could, which is only once every block has fitted. A
   * block that holds no others has no such thing to offer.
   */
  adopt?(moved: BlockSnapshot[]): boolean;
  /** Puts an empty line on one side of this block, with the caret in it. */
  insertLine(edge: "before" | "after"): void;
  /** Takes this block off the page. */
  remove(): void;
  /** Puts a block arriving from elsewhere right after this one. */
  dropAfter(moved: BlockSnapshot): void;
  /** The mirror, right before this one. */
  dropBefore(moved: BlockSnapshot): void;
};

export type Handles = {
  /** Registers one block's ops, and returns the leaving. */
  join(ops: BlockOps): () => void;
  /**
   * The ops registered for exactly this element, if it is one of the page's blocks.
   *
   * Asked about any element rather than an HTML one, because the walk up from
   * whatever the pointer is over starts inside a figure's own SVG as often as
   * not.
   */
  at(dom: Element): BlockOps | null;
  /** Every block currently on the page, in no particular order. */
  all(): BlockOps[];
};

/** @example const handles = createHandles(); const leave = handles.join(ops); */
export function createHandles(): Handles {
  const byElement = new Map<Element, BlockOps>();

  return {
    join(ops) {
      byElement.set(ops.dom, ops);
      return () => {
        if (byElement.get(ops.dom) === ops) byElement.delete(ops.dom);
      };
    },

    at(dom) {
      return byElement.get(dom) ?? null;
    },

    all() {
      return [...byElement.values()];
    },
  };
}

/**
 * The registered block an event landed in, or null when it landed on neither.
 *
 * Walks up from the exact target rather than assuming a fixed structure, so it
 * needs nothing about how deep a solo block's own node views nest their
 * content.
 *
 * The target is any element, not an HTML one. A hand-drawn figure is an inline
 * SVG, so the `<rect>` under the pointer is an `SVGElement` and a guard written
 * for HTML alone leaves the whole drawing — which is most of the block — with
 * no grip, while the thin margin of frame around it has one.
 */
export function blockAt(handles: Handles, container: HTMLElement, target: Element): BlockOps | null {
  if (!container.contains(target)) return null;

  let element: Element | null = target;
  while (element !== null && element !== container) {
    const ops = handles.at(element);
    if (ops !== null) return ops;
    element = element.parentElement;
  }

  return null;
}

/**
 * Moves blocks to stand beside another, in their order, folded into the one
 * entry a drag is meant to undo as.
 *
 * Dropping is choosing whose neighbourhood to land in. The target grows the
 * arriving blocks right where they were dropped, in its own stamp, and only
 * then do the sources let their own copies go, so there is no moment where a
 * block exists nowhere at all. A target that cannot hold every one of them
 * says so before any of that, and the move simply does not happen.
 *
 * @example moveBlocks(history, [heading, paragraph], target, "after");
 */
export function moveBlocks(history: History, sources: readonly BlockOps[], target: BlockOps, edge: "before" | "after") {
  if (sources.includes(target)) return;

  const moved = sources.map((source) => source.snapshot());
  if (moved.some((block) => target.accepts?.(block) === false)) return;

  history.batch(() => {
    if (edge === "before") moved.forEach((block) => target.dropBefore(block));
    else [...moved].reverse().forEach((block) => target.dropAfter(block));
    sources.forEach((source) => source.remove());
  });
}
