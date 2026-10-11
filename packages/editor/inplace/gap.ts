"use client";

/**
 * A click that lands between two blocks, given to the block it is nearest.
 *
 * The space between paragraphs is the article's own margin, which belongs to no
 * block, so a click there reaches the container and stops: the reader aimed at
 * the end of a line, hit the leading under it, and nothing happened at all. It
 * reads as the page being dead rather than as having missed by four pixels, and
 * the margins here are generous enough that missing is easy.
 *
 * So the container answers for the gaps. Only for the gaps: a click that landed
 * on anything a reader could have meant — a block they can write in, a fence or
 * a table they cannot, a link, a button — is left exactly where it fell. So is
 * the click that ends a drag across blocks, which lands on whatever holds both
 * ends and would otherwise throw away the text it just selected.
 */

import type { Roster } from "./roster";

/**
 * What a click must not have landed on for it to count as a click on nothing.
 *
 * A block of any kind carries the stamp, which is what separates the article's
 * own margin from everything drawn inside it. The rest are the things that sit
 * in a block and answer a click themselves.
 */
const SOMETHING = "[data-src-range], [contenteditable], a, button, input, textarea, select, summary";

/**
 * Makes the container hand a click in its margins to the nearest block's editor.
 *
 * @example const stop = gapClicks(articleElement, page.roster);
 */
export function gapClicks(container: HTMLElement, roster: Roster): () => void {
  const answer = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest(SOMETHING) !== null) return;
    if (window.getSelection()?.isCollapsed === false) return;

    const near = roster.nearest(event.clientY);
    if (near === null) return;

    const box = near.dom.getBoundingClientRect();
    near.enter(event.clientY < box.top ? "start" : "end", event.clientX);
  };

  container.addEventListener("click", answer);
  return () => container.removeEventListener("click", answer);
}
