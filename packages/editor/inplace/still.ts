/**
 * The blocks of the article that no component of ours answers for.
 *
 * A paragraph, a heading, a list, a quote and a callout each arrive as a
 * component that takes its own element over. Everything else on a page — a
 * table, a fence, an image, a `<Steps>`, a hand-drawn figure — is drawn by the
 * build exactly as the reader sees it and has nobody to register it. Those are
 * still blocks: real blocks of the file, with a real place on the page and a
 * real slice of source, that simply have no editor.
 *
 * They matter because the grip does not need one. Copying, duplicating,
 * deleting and dragging a block asks only where it is and what it says, and a
 * reader who cannot move a code fence out of the middle of a chapter is
 * looking at a page that is half editable. So the page sweeps itself once
 * after mounting and hands every unclaimed stamp to the same `mountBlock` the
 * editable ones go through, which makes a part of it, gives it a grip, and
 * leaves its markup untouched.
 */

import { CLAIMED, SOURCE_RANGE, rangeIn } from "@jotdown/core/lib/source-range";

/** One block of the article with a stamp, a place and a slice, and no editor. */
export type Still = {
  /** The element the article lays out, which is where a block dropped beside it goes. */
  flow: HTMLElement;
  stamp: string;
  /** The bytes this block was written as, which are also the bytes it prints back. */
  markdown: string;
};

/**
 * Every stamped block under `container` that is nobody's component to answer for.
 *
 * @example findStills(article, source); // [{ flow: <figure>, stamp: "12:1-16:4", markdown: "…" }]
 */
export function findStills(container: HTMLElement, source: string): Still[] {
  const unclaimed = container.querySelectorAll<HTMLElement>(`[${SOURCE_RANGE}]:not([${CLAIMED}])`);
  const found: Still[] = [];

  for (const element of unclaimed) {
    const stamp = element.getAttribute(SOURCE_RANGE);
    const range = stamp === null ? null : rangeIn(source, stamp);
    if (stamp === null || range === null) continue;

    found.push({
      flow: flowOf(element, container),
      stamp,
      markdown: source.slice(range.start, range.end),
    });
  }

  return found;
}

/**
 * The stamp of the empty range at the very end of the file, where a first block is written.
 *
 * @example endOfFile("---\ntitle: New\n---\n"); // "4:1-4:1"
 */
export function endOfFile(source: string) {
  const lines = source.split("\n");
  const end = `${lines.length}:${(lines.at(-1)?.length ?? 0) + 1}`;
  return `${end}-${end}`;
}

/**
 * A blank line to start writing on, for an article whose body has no blocks yet.
 *
 * A new page is front matter and nothing else, so the article draws no block,
 * and every way into writing (a click, the gutter plus, Enter at the end of a
 * line) starts from a block that is already there. This one is drawn by us,
 * stamped at the end of the file, and whatever is typed into it is written
 * there. Null when the body has any block at all.
 *
 * @example blankLine(article, "---\ntitle: New\n---\n"); // { flow: <p>, stamp: "4:1-4:1", markdown: "" }
 */
export function blankLine(container: HTMLElement, source: string): Still | null {
  if (container.querySelector(`[${SOURCE_RANGE}]`) !== null) return null;
  const body = container.querySelector<HTMLElement>(".prose");
  if (body === null) return null;

  const flow = document.createElement("p");
  const stamp = endOfFile(source);
  flow.setAttribute(SOURCE_RANGE, stamp);
  flow.setAttribute(CLAIMED, "1");
  body.append(flow);
  return { flow, stamp, markdown: "" };
}

/**
 * The element the article lays out for this block, which is not always the stamped one.
 *
 * The core draws a table inside a scrolling box of its own and the compiler
 * stamps the `<table>` within it, so a copy placed beside the stamped element
 * would land inside that box rather than after it, and a copy carried
 * elsewhere would arrive with no box at all. A wrapper drawn for one block is
 * an element holding nothing but that block, so the walk lifts through those
 * and stops at the first element with something beside it. It also stops short
 * of the container's own children, which are the article's chapters rather
 * than any one block's frame.
 */
export function flowOf(stamped: HTMLElement, container: HTMLElement): HTMLElement {
  let flow = stamped;

  while (true) {
    const parent = flow.parentElement;
    const wrapper =
      parent !== null &&
      parent !== container &&
      parent.parentElement !== null &&
      parent.parentElement !== container &&
      parent.childElementCount === 1 &&
      !parent.hasAttribute(SOURCE_RANGE);

    if (!wrapper) return flow;
    flow = parent;
  }
}
