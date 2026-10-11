"use client";

import { useEffect, type RefObject } from "react";
import { CLAIMED, rangeIn } from "@jotdown/core/lib/source-range";
import { useInplace, type Inplace } from "./context";
import type { BlockElements } from "./editor";

/**
 * Which elements inside a stamped one the editors take over.
 *
 * Most blocks are drawn as the element whose children are exactly the block's
 * children, so the stamped element is the answer. A heading and a callout are
 * not: the core puts an anchor and a copy button inside the `<h2>`, and a
 * callout's box holds a colour rail and an icon beside its prose, so those
 * point at something further in.
 *
 * The stamped element itself is the block's place in the article, which is a
 * separate question and one the hook answers for every block the same way.
 */
export type Within = (root: HTMLElement) => Omit<BlockElements, "flow"> | null;

const WHOLE: Within = (element) => ({ body: element });

/**
 * Hands a block's elements to the editor once, and reports what the reader types.
 *
 * A null markdown is the block reading as it did when the editor opened, which
 * the draft takes as no change at all. That is what lets a reader undo their
 * way back to a clean page, and it is decided where the printing happens
 * rather than here, because the printer is the only thing that knows what this
 * block looked like before anybody touched it.
 *
 * `within` has to be a constant rather than an inline arrow, because a new
 * function every render would tear the editor down and build it again.
 *
 * The element is claimed before anything is loaded, because the page's own
 * sweep for the blocks nobody answers for runs in the same pass and has to be
 * able to tell them apart without waiting on a chunk that arrives later.
 */
export function useEditable(root: RefObject<HTMLElement | null>, stamp: string | undefined, within: Within = WHOLE) {
  const inplace = useInplace();

  useEffect(() => {
    if (!inplace || !stamp || !root.current) return;

    const range = rangeIn(inplace.source, stamp);
    if (!range) return;

    const parts = within(root.current);
    if (!parts) return;

    const claimed = root.current;
    claimed.setAttribute(CLAIMED, "1");

    const elements = { ...parts, flow: claimed };
    let stop: (() => void) | null = null;
    let cancelled = false;

    void Promise.all([import("./region"), inplace.recovery.start()]).then(([{ mountBlock }]) => {
      if (cancelled) return;
      stop = mountBlock(
        elements,
        inplace.source.slice(range.start, range.end),
        (markdown) => inplace.draft.write(stamp, markdown),
        inplace,
        stamp,
      );
    });

    return () => {
      cancelled = true;
      claimed.removeAttribute(CLAIMED);
      stop?.();
    };
  }, [inplace, stamp, root, within]);
}

/**
 * Gives a grip to every block of the article no component answers for, or a
 * blank line to write on when the article has no blocks at all.
 *
 * Run once from the page rather than per block, because there is no component
 * to run it from: a hand-drawn figure and a block the bridge
 * cannot map are drawn by the build, and nothing of ours is between them and
 * the page. The sweep happens after the article's own components have mounted
 * and claimed their elements, which is what the parent effect running last
 * gives for free.
 *
 * The page is handed in rather than read from the context, because the one
 * component with a reason to run this is the component that *provides* that
 * context, and a provider is not inside its own subtree. Reading it there
 * comes back null on every render, every effect returns at its first line, and
 * nothing anywhere says so.
 *
 * @example useStills(containerRef, page);
 */
export function useStills(container: RefObject<HTMLElement | null>, inplace: Inplace | null) {
  useEffect(() => {
    if (!inplace || !container.current) return;

    const root = container.current;
    let stops: Array<() => void> = [];
    let cancelled = false;

    const loading = [import("./region"), import("./still"), inplace.recovery.start()] as const;

    void Promise.all(loading).then(([{ mountBlock }, { blankLine, findStills }]) => {
      if (cancelled) return;

      const blank = blankLine(root, inplace.source);
      const blocks = blank ? [blank] : findStills(root, inplace.source);

      stops = blocks.map(({ flow, stamp, markdown }) => {
        const stop = mountBlock(
          { flow, body: flow },
          markdown,
          (edited) => inplace.draft.write(stamp, edited),
          inplace,
          stamp,
          blank === null,
        );
        if (!blank) return stop;

        return () => {
          stop();
          flow.remove();
        };
      });
    });

    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [inplace, container]);
}
