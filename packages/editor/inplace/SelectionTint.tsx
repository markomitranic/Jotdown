"use client";

/**
 * The faint tint and border over every block in a block selection.
 *
 * Drawn over the blocks rather than on them, so no block's own element is
 * restyled and nothing about it can be left behind once the selection ends.
 */

import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useInplace } from "./context";
import type { BlockOps } from "./handles";
import { blockBounds } from "./handleGeometry";
import { standing } from "./blockSelection";

type Spot = { top: number; left: number; width: number; height: number };

const quiet = () => () => {};
const NOTHING: readonly BlockOps[] = [];
const nothing = () => NOTHING;

/** @example <InplaceSelectionTint container={containerRef} /> */
export function InplaceSelectionTint({ container }: { container: RefObject<HTMLElement | null> }) {
  const blocks = useInplace()?.blocks;
  const selected = useSyncExternalStore(blocks?.subscribe ?? quiet, blocks?.get ?? nothing, nothing);
  const [spots, setSpots] = useState<Spot[]>([]);

  useLayoutEffect(() => {
    const box = container.current;
    if (box === null || selected.length === 0) {
      setSpots([]);
      return;
    }

    const measure = () => setSpots(selected.filter(standing).map((ops) => spotOf(ops, box)));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selected, container]);

  return spots.map((spot, index) => (
    <div
      // biome-ignore lint/suspicious/noArrayIndexKey: tints are redrawn from scratch on every measure and hold no state
      key={index}
      aria-hidden="true"
      className="pointer-events-none absolute z-3 rounded-md bg-primary/10 ring-1 ring-primary/40"
      style={spot}
    />
  ));
}

/** The box to draw around a selected block, in the container's own coordinates, a little outside it. */
function spotOf(ops: BlockOps, container: HTMLElement): Spot {
  const box = blockBounds(ops.box);
  const bounds = container.getBoundingClientRect();

  return {
    top: box.top - bounds.top - 3,
    left: box.left - bounds.left - 4,
    width: box.width + 8,
    height: box.height + 6,
  };
}
