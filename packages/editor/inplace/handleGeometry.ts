import type { BlockOps, Handles } from "./handles";

export const HANDLE_WIDTH = 20;
export const HANDLE_HEIGHT = 24;
export const HANDLE_GAP = 4;

type Bounds = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "height">;

/** A horizontal band of the page, such as a block's first line of text. */
type Band = { top: number; height: number };

const PROSE = "p, h1, h2, h3, h4, h5, h6, li";
const LEADS_WITH_PROSE = "ul, ol, blockquote";
const PICTURE = ":is(.jd-shot-img, .jd-missing-art)";

/** Measures the block itself, unwrapping editor hosts without descending into its content. */
export function blockBounds(box: HTMLElement): DOMRect {
  return blockElement(box).getBoundingClientRect();
}

/**
 * The first line of text a grip lines up with, or null for a block whose top edge is its frame.
 *
 * A line of prose is taller than the grip, and a heading's much more so, so a grip pinned to the
 * block's top sits above the words. A fence or a callout draws a border there instead, which a
 * grip lines up with best.
 *
 * @example firstLine(heading); // { top: 120, height: 32 }
 */
export function firstLine(block: Element): Band | null {
  const text = block.matches(PROSE) ? block : block.matches(LEADS_WITH_PROSE) ? block.querySelector(PROSE) : null;
  if (text === null) return null;

  const style = getComputedStyle(text);
  const height = parseFloat(style.lineHeight);
  if (Number.isNaN(height)) return null;

  const top = text.getBoundingClientRect().top + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
  return { top, height };
}

/**
 * The top edge of an image block's picture, or null for a block that does not open with one.
 *
 * The article's typography spaces a picture away from its frame, so a grip pinned to the frame
 * floats in the gap above the picture rather than beside it. A picture inside a callout leaves
 * the grip on the callout, whose frame starts first.
 *
 * @example pictureEdge(image); // { top: 364, height: 24 }
 */
export function pictureEdge(block: Element): Band | null {
  const shot = block.matches(".jd-shot") ? block : block.querySelector(".jd-shot");
  const picture = shot?.querySelector(PICTURE);
  if (!shot || !picture) return null;

  const opensTheBlock = Math.abs(shot.getBoundingClientRect().top - block.getBoundingClientRect().top) < 1;
  return opensTheBlock ? { top: picture.getBoundingClientRect().top, height: HANDLE_HEIGHT } : null;
}

/**
 * Returns the block's bounds and its grip, centred on the block's first line when it has one.
 *
 * A `<Steps>` rail's numbers hang out past its left edge, so its bounds reach out to them and its
 * grip clears them. A step's grip is drawn over its own number, the one place beside it with room.
 *
 * @example gripOf(ops.box).grip.left; // 76
 */
export function gripOf(box: HTMLElement) {
  const element = blockElement(box);
  const rect = element.getBoundingClientRect();
  const number = numberOf(element);
  const left = Math.min(rect.left, number?.left ?? rect.left);
  const bounds = {
    top: rect.top,
    bottom: rect.bottom,
    right: rect.right,
    height: rect.height,
    left,
    width: rect.right - left,
  };
  const line = pictureEdge(element) ?? firstLine(element) ?? undefined;

  if (number !== null && element.matches(".jd-step")) {
    const grip = {
      left: number.left,
      top: number.top,
      right: number.left + number.width,
      bottom: number.top + number.height,
    };
    return { bounds, line, grip, onNumber: true };
  }

  return { bounds, line, grip: handleBounds(bounds, line), onNumber: false };
}

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

/**
 * The number circle of a step, or of a rail's first step, as the rail draws it.
 *
 * The circle is the step's `::before`, placed against the rail rather than the step, so it is
 * measured from the rail's padding edge and the step's own top.
 *
 * @example numberOf(firstStep); // { left: 283, top: 158, width: 32, height: 32 }
 */
function numberOf(element: HTMLElement): Box | null {
  const step = element.matches(".jd-steps") ? element.querySelector(".jd-step") : element;
  const rail = step?.matches(".jd-step") ? step.closest(".jd-steps") : null;
  if (!step || !rail) return null;

  const mark = getComputedStyle(step, "::before");
  const inset = parseFloat(mark.left);
  if (Number.isNaN(inset)) return null;

  const edge = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).borderLeftWidth);
  return {
    left: edge + inset,
    top: step.getBoundingClientRect().top,
    width: parseFloat(mark.width),
    height: parseFloat(mark.height),
  };
}

/**
 * The element a block actually draws, past the editor hosts wrapped around it.
 *
 * A walk ending on a `display: contents` element found a node view laying its children straight
 * into the frame the build drew, a `<Steps>` rail, so that frame is the block.
 */
function blockElement(box: HTMLElement): HTMLElement {
  let element = box;

  while (element.childElementCount === 1) {
    const wrapper =
      element.style.display === "contents" ||
      element.matches("div.ProseMirror, .react-renderer, .tableWrapper") ||
      (element.hasAttribute("data-node-view-wrapper") && element.classList.length === 0);
    const child = element.firstElementChild;
    if (!wrapper || !(child instanceof HTMLElement)) break;
    element = child;
  }

  return getComputedStyle(element).display === "contents" ? box : element;
}

/**
 * Returns viewport coordinates for a grip just left of a block, centred on its first line.
 *
 * Without a line the grip centres on a short block and sits at the top of a tall one. Grip and
 * gap together fit the narrowest margin between the sidebar and the article, 24px.
 *
 * @example handleBounds({ left: 100, right: 300, top: 50, bottom: 51, height: 1 }).left; // 76
 */
export function handleBounds(
  block: Bounds,
  line: Band = { top: block.top, height: Math.min(block.height, HANDLE_HEIGHT) },
) {
  const top = line.top + (line.height - HANDLE_HEIGHT) / 2;
  const left = block.left - HANDLE_GAP - HANDLE_WIDTH;
  return { left, right: left + HANDLE_WIDTH, top, bottom: top + HANDLE_HEIGHT };
}

/** Tests the continuous hover area covering a block, its grip, and the gap between them.
 * @example withinHandleArea(block, block.left - 10, block.top); // true
 */
export function withinHandleArea(block: Bounds, x: number, y: number, grip = handleBounds(block)): boolean {
  return (
    x >= Math.min(grip.left, block.left) &&
    x <= block.right &&
    y >= grip.top &&
    y <= Math.max(block.bottom, grip.bottom)
  );
}

/** Finds a block through its expanded hover area, preferring nested blocks over their parents. */
export function handleAt(handles: Handles, x: number, y: number): BlockOps | null {
  let found: BlockOps | null = null;

  for (const ops of handles.all()) {
    if (!ops.dom.isConnected) continue;
    const { bounds, grip } = gripOf(ops.box);
    if (bounds.width === 0 && bounds.height === 0) continue;
    if (!withinHandleArea(bounds, x, y, grip)) continue;
    if (found === null || found.dom.contains(ops.dom)) found = ops;
  }

  return found;
}
