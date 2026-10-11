"use client";

/** The two grips on a widenable block's sides, dragged out to stand it wider than the column. */

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { WIDTH, type BlockWidth } from "@jotdown/core/lib/block-width";
import type { BlockOps } from "./handles";
import { blockBounds } from "./handleGeometry";

/** Marks the grips, so the pointer reaching one is not read as leaving the block. */
export const WIDTH_HANDLE = "data-width-handle";

/** How far outside the block's edge a grip stands, and the strip either side that keeps it hovered. */
const OFFSET = 10;
export const WIDTH_REACH = 28;

const WIDTHS: readonly BlockWidth[] = ["normal", "wide", "full"];

export const WIDTH_NAMES: Record<BlockWidth, string> = {
  normal: "Column",
  wide: "Wide",
  full: "Full width",
};

type Edges = { left: number; right: number; top: number; bottom: number };

type Resizing = {
  from: BlockWidth;
  centre: number;
  stops: Record<BlockWidth, number>;
  onto: BlockWidth;
};

/**
 * Draws a grip on each side of a block that can widen, and stands it at the stop nearest a drag.
 *
 * The block grows from its centre, so either grip does the same thing, and a
 * table, whose left side belongs to its row grips, gets the right-hand one only. While a
 * grip is held the block itself does not move: an outline shows where it will
 * stand and faint rules mark the other stops, and the width is written once,
 * on release, as one step of the page's history. Escape lets go without
 * changing anything.
 *
 * @example <WidthHandles ops={hovered} onResizing={setResizing} />
 */
export function WidthHandles({ ops, onResizing }: { ops: BlockOps; onResizing(resizing: boolean): void }) {
  const [edges, setEdges] = useState<Edges | null>(null);
  const [resizing, setResizing] = useState<Resizing | null>(null);
  const held = useRef<Resizing | null>(null);
  const width = ops.width?.() ?? null;

  function release(commit: boolean) {
    const done = held.current;
    held.current = null;
    setResizing(null);
    onResizing(false);

    if (commit && done !== null && done.onto !== done.from) ops.widen?.(done.onto);
  }

  useLayoutEffect(() => {
    if (width === null) return;

    const remeasure = () => setEdges(ops.dom.isConnected ? visibleEdges(ops.box) : null);

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(ops.box);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [ops, width]);

  const holding = resizing !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: release only touches refs and state setters
  useEffect(() => {
    if (!holding) return;

    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") release(false);
    };

    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [holding]);

  if (width === null || edges === null) return null;

  const grab = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const centre = (edges.left + edges.right) / 2;
    const start = { from: width, centre, stops: stopsFor(ops.dom), onto: width };

    held.current = start;
    setResizing(start);
    onResizing(true);
  };

  const drag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const now = held.current;
    if (now === null) return;

    const span = Math.max(2 * Math.abs(event.clientX - now.centre), 48);
    const next = { ...now, onto: nearest(now.stops, span, now.from) };

    held.current = next;
    setResizing(next);
  };

  const middle = (edges.top + edges.bottom) / 2;
  const height = Math.min(40, Math.max(edges.bottom - edges.top - 16, 20));

  const grip = (side: "left" | "right") => (
    <button
      key={side}
      type="button"
      {...{ [WIDTH_HANDLE]: "" }}
      aria-label={`Drag to change the width, now ${WIDTH_NAMES[width]}`}
      title="Drag to widen"
      className="group fixed z-40 grid pointer-coarse:hidden w-4 cursor-ew-resize touch-none place-items-center max-lg:hidden"
      style={{
        top: middle - height / 2,
        left: side === "left" ? edges.left - OFFSET - 8 : edges.right + OFFSET - 8,
        height,
      }}
      onPointerDown={grab}
      onPointerMove={drag}
      onPointerUp={() => release(true)}
      onPointerCancel={() => release(false)}
      onLostPointerCapture={() => {
        if (held.current !== null) release(false);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-full w-1 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-foreground/70",
          resizing && "bg-primary group-hover:bg-primary",
        )}
      />
    </button>
  );

  return createPortal(
    <>
      {resizing && <Outline edges={edges} resizing={resizing} />}
      {!holdsRowGrips(ops.box) && grip("left")}
      {grip("right")}
    </>,
    document.body,
  );
}

/**
 * Where the block will stand if the grip is let go now, and where the other stops are.
 *
 * Drawn over the block rather than by resizing it, so a drag across a long
 * table lays nothing out again until the release. The outline follows the
 * stop rather than the pointer, which is what makes the snap readable.
 */
function Outline({ edges, resizing }: { edges: Edges; resizing: Resizing }) {
  const { centre, stops, onto } = resizing;
  const top = Math.max(edges.top, 0);
  const height = Math.min(edges.bottom, window.innerHeight) - top;
  const span = stops[onto];

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30">
      {WIDTHS.filter((stop) => stop !== onto).map((stop) => (
        <div key={stop}>
          <Rule x={centre - stops[stop] / 2} top={top} height={height} />
          <Rule x={centre + stops[stop] / 2} top={top} height={height} />
        </div>
      ))}

      <div
        className="absolute rounded-md border-2 border-primary bg-primary/5"
        style={{ top, height, left: centre - span / 2, width: span }}
      >
        <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-sm bg-primary px-1.5 py-0.5 font-medium text-primary-foreground text-xs">
          {WIDTH_NAMES[onto]}
        </span>
      </div>
    </div>
  );
}

function Rule({ x, top, height }: { x: number; top: number; height: number }) {
  return <div className="absolute w-px bg-primary/30" style={{ left: x, top, height }} />;
}

/**
 * How wide the block stands at each width, measured by standing a probe beside it.
 *
 * The stylesheet is the one place the widths are worked out, so asking it is
 * the only answer that cannot drift from what a release will actually show.
 *
 * @example stopsFor(table); // { normal: 836, wide: 1200, full: 1492 }
 */
function stopsFor(block: HTMLElement): Record<BlockWidth, number> {
  const host = block.parentElement ?? block;
  const probe = document.createElement("div");
  probe.style.cssText = "height:0;visibility:hidden;margin-block:0;padding:0;border:0";
  host.append(probe);

  const measure = (width: BlockWidth) => {
    if (width === "normal") probe.removeAttribute(WIDTH);
    else probe.setAttribute(WIDTH, width);
    return probe.getBoundingClientRect().width;
  };

  const stops = { normal: measure("normal"), wide: measure("wide"), full: measure("full") };
  probe.remove();
  return stops;
}

/**
 * The stop nearest a span, keeping the current one when two stand at the same width.
 *
 * On a screen with no room to spare the three stops measure the same, and
 * keeping what the block already has stops a click on a grip from rewriting it.
 *
 * @example nearest({ normal: 800, wide: 1200, full: 1500 }, 1100, "normal"); // "wide"
 */
function nearest(stops: Record<BlockWidth, number>, span: number, current: BlockWidth): BlockWidth {
  const order = [current, ...WIDTHS.filter((width) => width !== current)];

  return order.reduce((best, width) =>
    Math.abs(stops[width] - span) < Math.abs(stops[best] - span) - 0.5 ? width : best,
  );
}

/**
 * Whether the block is a table, whose rows already have grips down its left side.
 *
 * A width grip there would sit on top of them, and the block grows from its
 * centre anyway, so the right-hand grip alone does the whole job.
 */
function holdsRowGrips(box: HTMLElement) {
  return box.querySelector("table") !== null;
}

/**
 * The edges of what a reader sees as the block, so the grips sit against it.
 *
 * A picture narrower than the column is centred in a paragraph as wide as the
 * column, and grips on the paragraph's edges would float in empty space.
 */
function visibleEdges(box: HTMLElement): Edges {
  const picture = box.querySelector(".jd-shot-img, .jd-missing-art");
  const { left, right, top, bottom } = picture ? picture.getBoundingClientRect() : blockBounds(box);

  return { left, right, top, bottom };
}
