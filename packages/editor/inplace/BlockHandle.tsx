"use client";

/** Shared block grip, menu, and drag interaction for registered blocks. */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import type { DragEvent, RefObject } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  CodeXml,
  CopyPlus,
  FileCode,
  FoldHorizontal,
  GripVertical,
  Link2,
  MoveHorizontal,
  Repeat2,
  Settings2,
  StretchHorizontal,
  Trash2,
  UnfoldHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";
import { useInplace } from "./context";
import { blockAt, moveBlocks, type BlockOps, type BlockSnapshot, type Handles } from "./handles";
import { markdownOf, plainHtml } from "./clipboard";
import { blockBounds, gripOf, handleAt, HANDLE_GAP } from "./handleGeometry";
import type { TurnKind } from "./turn";
import { TurnIntoItems } from "./TurnInto";
import { WIDTH_HANDLE, WIDTH_NAMES, WIDTH_REACH, WidthHandles } from "./WidthHandles";
import type { BlockWidth } from "@jotdown/core/lib/block-width";
import { settingsOf } from "../project/settings";

const quiet = () => () => {};
const NOTHING: readonly BlockOps[] = [];
const nothing = () => NOTHING;

/** Allows block drops in the article gutter while dragging a grip. */
const REACH = 60;

const WIDTH_ICONS: Record<BlockWidth, typeof Check> = {
  normal: FoldHorizontal,
  wide: UnfoldHorizontal,
  full: StretchHorizontal,
};

/** A block boundary something is about to land on. */
export type Landing = { ops: BlockOps; edge: "before" | "after" };

type Dragging = {
  from: readonly BlockOps[];
  moved: BlockSnapshot[];
  onto: Landing | null;
};

/**
 * Renders a floating block grip and drop feedback for the supplied article container.
 *
 * The menu opens on click and anchors to an inert span inside the grip, because a
 * menu trigger opens on press and cancels it, and a cancelled press never becomes a drag.
 * The grip of a block that is part of a block selection acts on the whole selection.
 * Opening the menu puts the selection menu away, so the two never stand on top of each other.
 *
 * @example <InplaceBlockHandle container={containerRef} />
 */
export function InplaceBlockHandle({ container }: { container: RefObject<HTMLElement | null> }) {
  const page = useInplace();
  const [hovered, setHovered] = useState<BlockOps | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [menu, setMenu] = useState(false);
  const [indicator, setIndicator] = useState<Landing | null>(null);
  const dragging = useRef<Dragging | null>(null);
  const resizing = useRef(false);
  const suppressed = useRef<HTMLElement[]>([]);
  const button = useRef<HTMLButtonElement>(null);
  const group = useSyncExternalStore(page?.blocks.subscribe ?? quiet, page?.blocks.get ?? nothing, nothing);

  useEffect(() => {
    if (!page) return;

    const track = (event: PointerEvent) => {
      if (dragging.current || resizing.current || menu) return;

      const root = container.current;
      const target = event.target instanceof Element ? event.target : null;
      const over = root === null || target === null ? null : blockAt(page.handles, root, target);

      if (target?.closest(`[${WIDTH_HANDLE}]`)) return;

      if (hovered?.dom.isConnected) {
        const { bounds, grip } = gripOf(hovered.box);
        const onBridge =
          event.clientX >= grip.left &&
          event.clientX <= bounds.left &&
          event.clientY >= grip.top &&
          event.clientY <= grip.bottom;
        if (onBridge || besideWidening(hovered, bounds, event)) return;
      }

      const nearby = handleAt(page.handles, event.clientX, event.clientY);
      setHovered(nearby !== null && (over === null || over.dom.contains(nearby.dom)) ? nearby : over);
    };

    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [page, container, hovered, menu]);

  useLayoutEffect(() => {
    const box = container.current;

    if (hovered === null || box === null) {
      setSpot(null);
      return;
    }

    const remeasure = () => {
      if (!hovered.dom.isConnected) {
        setHovered(null);
        return;
      }

      const { grip, onNumber } = gripOf(hovered.box);
      setSpot({
        top: grip.top,
        left: grip.left,
        width: grip.right - grip.left,
        height: grip.bottom - grip.top,
        onNumber,
      });
    };

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(box);
    observer.observe(hovered.box);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [hovered, container]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: end only touches refs and a state setter, so a fresh copy each render changes nothing
  useEffect(() => {
    const over = (event: globalThis.DragEvent) => {
      const drag = dragging.current;
      if (drag === null) return;
      event.preventDefault();
      event.stopPropagation();

      const root = container.current;
      const onto =
        root === null || page === null
          ? null
          : nearestEdge(page.handles, root, event.clientX, event.clientY, drag.moved, drag.from);

      drag.onto = onto;
      setIndicator(onto);
    };

    const drop = (event: globalThis.DragEvent) => {
      const drag = dragging.current;
      if (drag === null) return;

      end();
      event.preventDefault();
      event.stopPropagation();

      if (drag.onto !== null && page !== null) moveBlocks(page.history, drag.from, drag.onto.ops, drag.onto.edge);
      page?.blocks.clear();
    };

    window.addEventListener("dragover", over, true);
    window.addEventListener("drop", drop, true);
    return () => {
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("drop", drop, true);
    };
  }, [page, container]);

  if (!page) return null;

  const targets = hovered === null ? [] : group.includes(hovered) ? group : [hovered];
  const kind = targets.length === 1 ? (targets[0]?.kind?.() ?? null) : null;
  const settings = targets.length === 1 && targets[0] ? settingsOf(targets[0].dom) : undefined;

  const copyMarkdown = () => {
    void navigator.clipboard.writeText(markdownOf(targets)).catch(() => undefined);
  };

  const copyHtml = () => {
    void navigator.clipboard.write([richCopy(targets)]).catch(() => undefined);
  };

  const duplicate = () => {
    const last = targets.at(-1);
    if (targets.length === 1) last?.duplicate();
    else if (last !== undefined)
      page.history.batch(() => [...targets].reverse().forEach((block) => last.dropAfter(block.snapshot())));
  };

  const insertLine = (edge: "before" | "after") => {
    (edge === "before" ? targets[0] : targets.at(-1))?.insertLine(edge);
    page.blocks.clear();
    setHovered(null);
  };

  const remove = () => {
    page.history.batch(() => targets.forEach((block) => block.remove()));
    page.blocks.clear();
    setHovered(null);
  };

  const turn = (into: TurnKind) => {
    hovered?.turnInto?.(into);
    setHovered(null);
  };

  const width = targets.length === 1 ? (targets[0]?.width?.() ?? null) : null;
  const unembed = targets.length === 1 ? targets[0]?.unembed : undefined;

  const start = (event: DragEvent<HTMLButtonElement>) => {
    if (targets.length === 0) return;

    dragging.current = { from: targets, moved: targets.map((block) => block.snapshot()), onto: null };
    event.dataTransfer.setData("text/plain", markdownOf(targets));
    event.dataTransfer.effectAllowed = "move";
    carry(
      event,
      targets.map((block) => block.box),
    );

    const root = container.current;
    suppressed.current = root === null ? [] : [...root.querySelectorAll<HTMLElement>('[contenteditable="true"]')];
    suppressed.current.forEach((element) => (element.contentEditable = "false"));
  };

  /**
   * Gives the editors back, from the drop or the drag's own end, whichever arrives.
   *
   * A browser sends the end to the element the drag started on, and a grip
   * that moved under the pointer during the drag is not there to hear it. The
   * grip lets go of focus too, so the next Cmd+Z reaches the page.
   */
  function end() {
    dragging.current = null;
    setIndicator(null);
    suppressed.current.forEach((element) => (element.contentEditable = "true"));
    suppressed.current = [];
    button.current?.blur();
  }

  return (
    <>
      {hovered !== null &&
        spot !== null &&
        createPortal(
          <DropdownMenu open={menu} onOpenChange={setMenu} modal={false}>
            <button
              ref={button}
              type="button"
              draggable
              className={cn(
                "fixed z-40 grid pointer-coarse:hidden cursor-grab place-items-center text-muted-foreground transition-colors hover:bg-accent focus-visible:bg-accent active:cursor-grabbing data-[state=open]:bg-accent data-[state=open]:text-foreground max-lg:hidden",
                spot.onNumber ? "rounded-full bg-secondary" : "rounded-md",
              )}
              style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
              title="Click for this block's menu, drag to move it"
              aria-label="Open this block's menu, or drag to move it"
              aria-haspopup="menu"
              aria-expanded={menu}
              data-state={menu ? "open" : "closed"}
              onClick={() => {
                page.selection.clear();
                setMenu((open) => !open);
              }}
              onDragStart={start}
              onDragEnd={end}
            >
              <DropdownMenuTrigger asChild>
                <span aria-hidden="true" className="pointer-events-none absolute inset-0" />
              </DropdownMenuTrigger>
              <span aria-hidden="true" className="absolute inset-y-0 left-full" style={{ width: HANDLE_GAP }} />
              <GripVertical className="size-4" aria-hidden="true" />
            </button>

            <DropdownMenuContent
              side="bottom"
              sideOffset={6}
              collisionPadding={12}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onInteractOutside={(event) => {
                if (event.target instanceof Node && button.current?.contains(event.target)) event.preventDefault();
              }}
              className="w-52"
            >
              {settings && (
                <>
                  <DropdownMenuItem onSelect={settings}>
                    <Settings2 />
                    Settings…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {kind !== null && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Repeat2 />
                    Turn into
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent sideOffset={6} className="w-52">
                    <TurnIntoItems current={kind} onTurn={turn} />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {unembed !== undefined && (
                <DropdownMenuItem
                  onSelect={() => {
                    unembed();
                    setHovered(null);
                  }}
                >
                  <Link2 />
                  Turn into link
                </DropdownMenuItem>
              )}
              {width !== null && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <MoveHorizontal />
                    Width
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent sideOffset={6} className="w-44">
                    {(["normal", "wide", "full"] as const).map((into) => {
                      const Icon = WIDTH_ICONS[into];

                      return (
                        <DropdownMenuItem key={into} onSelect={() => hovered?.widen?.(into)}>
                          <Icon />
                          {WIDTH_NAMES[into]}
                          {into === width && <Check className="ml-auto" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem onSelect={() => insertLine("before")}>
                <ArrowUpToLine />
                Insert above
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => insertLine("after")}>
                <ArrowDownToLine />
                Insert below
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={copyMarkdown}>
                <FileCode />
                Copy as markdown
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyHtml}>
                <CodeXml />
                Copy as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={duplicate}>
                <CopyPlus />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2 />
                Delete
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>,
          document.body,
        )}

      {hovered !== null && width !== null && !menu && indicator === null && (
        <WidthHandles ops={hovered} onResizing={(now) => (resizing.current = now)} />
      )}

      <DropLine landing={indicator} container={container} />
    </>
  );
}

/**
 * Whether the pointer is in the strip beside a widenable block, on its way to one of the width grips.
 *
 * The grips stand outside the block, so without this the pointer leaves the
 * block, the block stops being hovered and the grip it was reaching for goes.
 */
function besideWidening(
  ops: BlockOps,
  bounds: { left: number; right: number; top: number; bottom: number },
  event: PointerEvent,
) {
  if (ops.width?.() == null) return false;

  const { clientX: x, clientY: y } = event;
  const beside =
    (x >= bounds.left - WIDTH_REACH && x < bounds.left) || (x > bounds.right && x <= bounds.right + WIDTH_REACH);
  return beside && y >= bounds.top && y <= bounds.bottom;
}

/**
 * Blocks as formatted text, for pasting into a mail, a chat or a document, with their markdown beside it.
 *
 * @example navigator.clipboard.write([richCopy([block])]);
 */
function richCopy(blocks: readonly BlockOps[]) {
  return new ClipboardItem({
    "text/html": new Blob([blocks.map(plainHtml).join("\n")], { type: "text/html" }),
    "text/plain": new Blob([markdownOf(blocks)], { type: "text/plain" }),
  });
}

type Spot = { top: number; left: number; width: number; height: number; onNumber: boolean };

/**
 * Gives the pointer a faint, slightly turned copy of the blocks to carry.
 *
 * Without one a browser drags the grip, which is a five-pixel button, so the
 * pointer carries no sign of which block is in the air. The copy is the blocks
 * themselves, at their own width, so a drag over a callout is a reader holding
 * the paragraphs they picked up against the place they are about to put them.
 *
 * The turn is on the copy rather than on the wrapper the browser is handed,
 * because a drag image is rasterised from the element given to it and a
 * transform on that outermost element is not part of what is drawn.
 *
 * It has to be in the document to be rasterised and must not be seen there, so
 * it is parked above the window and taken away on the next tick, by which time
 * the browser has its picture.
 */
function carry(event: DragEvent<HTMLElement>, boxes: HTMLElement[]) {
  const [first] = boxes;
  if (first === undefined) return;

  const stage = document.createElement("div");
  const ghost = document.createElement("div");
  const { width } = first.getBoundingClientRect();

  ghost.append(...boxes.map((box) => box.cloneNode(true)));
  ghost.style.width = `${width}px`;
  ghost.style.opacity = "0.7";
  ghost.style.transform = "rotate(2deg)";
  ghost.style.background = "var(--color-card)";

  stage.style.position = "fixed";
  stage.style.top = "-10000px";
  stage.style.left = "0";
  stage.style.pointerEvents = "none";
  stage.append(ghost);
  document.body.append(stage);

  event.dataTransfer.setDragImage(stage, 24, 16);
  setTimeout(() => stage.remove(), 0);
}

/**
 * The line between two blocks that says where a drop is about to land.
 *
 * @example <DropLine landing={{ ops, edge: "after" }} container={containerRef} />
 */
export function DropLine({
  landing,
  container,
}: {
  landing: Landing | null;
  container: RefObject<HTMLElement | null>;
}) {
  if (landing === null || container.current === null) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_var(--color-background)]"
      style={edgeSpot(landing, container.current)}
    />
  );
}

/**
 * The registered block boundary nearest the pointer, wherever inside the
 * container it is.
 *
 * A drop landing exactly inside a block's own box is a small target, and the
 * gap between two blocks belongs to neither: a pointer there would hit
 * whatever sits behind them, never a block at all. So this asks every block on
 * the page for its own top and bottom edge and picks whichever is closest,
 * which turns the gap itself into a drop zone rather than dead space.
 *
 * A block inside another is not offered once the pointer has left that other
 * and the other could take the drop itself, so the space just below a callout
 * or a `<Steps>` is below the whole block rather than below its last line. A
 * step takes no paragraph, so the gap between two steps still lands in one. The same reach the gutter gets
 * on the left is given below the article, which is how a block lands last.
 *
 * Two kinds of block are never offered. A block inside the one being dragged
 * would be a block dropped into itself, and a block whose surface cannot hold
 * what is arriving — a callout, handed a code fence — would take it off the
 * page it came from and have nowhere to put it. Both simply draw no indicator,
 * which is the whole of the feedback a reader needs.
 *
 * `from` is the blocks being moved, or none for something arriving from outside
 * the page, a file off the desktop.
 *
 * @example nearestEdge(page.handles, article, x, y, moved, []); // { ops, edge: "after" }
 */
export function nearestEdge(
  handles: Handles,
  container: HTMLElement,
  x: number,
  y: number,
  arriving: readonly BlockSnapshot[],
  from: readonly BlockOps[],
): Landing | null {
  const bounds = container.getBoundingClientRect();
  const outside = x < bounds.left - REACH || x > bounds.right || y < bounds.top || y > bounds.bottom + REACH;
  if (outside) return null;

  const standing = handles
    .all()
    .filter((ops) => ops.dom.isConnected)
    .map((ops) => ({ ops, box: blockBounds(ops.box) }))
    .filter(({ box }) => !drawsNothing(box));

  const holds = (ops: BlockOps) => arriving.every((block) => ops.accepts?.(block) !== false);
  const passed = standing.filter(({ ops, box }) => (y < box.top || y > box.bottom) && holds(ops)).map(({ ops }) => ops);

  let nearest: (Landing & { distance: number }) | null = null;

  for (const { ops, box } of standing) {
    if (from.some((moving) => moving.dom.contains(ops.dom))) continue;
    if (passed.some((outer) => outer !== ops && outer.dom.contains(ops.dom))) continue;
    if (!holds(ops)) continue;

    const edges = [
      { edge: "before" as const, at: box.top },
      { edge: "after" as const, at: box.bottom },
    ];

    for (const { edge, at } of edges) {
      const distance = Math.abs(at - y);
      if (nearest === null || distance < nearest.distance) nearest = { ops, edge, distance };
    }
  }

  return nearest === null ? null : { ops: nearest.ops, edge: nearest.edge };
}

/**
 * Whether a block is on the page in name only.
 *
 * A block the reader deleted keeps its place in the registry, hidden, so that
 * one Cmd+Z can bring it back. Hidden, it has no edges, and offering its
 * collapsed position as somewhere to drop would put the block there instead of
 * where the pointer is.
 */
export function drawsNothing(box: DOMRect): boolean {
  return box.width === 0 && box.height === 0;
}

/**
 * Where the drop indicator sits, against the same container the grip does.
 *
 * It is as wide as the block it is drawn against rather than as wide as the
 * article, because a line the width of the page would say the same thing about
 * a paragraph of the article and a paragraph inside a callout, which are two
 * different places to land.
 */
function edgeSpot(indicator: Landing, container: HTMLElement): { top: number; left: number; width: number } {
  const box = blockBounds(indicator.ops.box);
  const bounds = container.getBoundingClientRect();

  return {
    top: (indicator.edge === "before" ? box.top : box.bottom) - bounds.top,
    left: box.left - bounds.left,
    width: Math.max(box.width, 48),
  };
}
