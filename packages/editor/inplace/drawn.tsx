import type { JSONContent } from "@tiptap/core";
import { Heading } from "@jotdown/core/components/blocks/Heading";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { unmountLater } from "./portals";
import type { BlockElements } from "./editor";

export type DrawnBlock = {
  elements: BlockElements;
  release(): void;
};

/**
 * Draws a newly inserted block with the same component the reader uses.
 *
 * Plain prose needs only its native tag. A heading goes through React because
 * The core puts an anchor and a copy button inside it that a hand-written
 * element would lose.
 *
 * @example drawBlock({ type: "paragraph" }); // a new editable paragraph
 */
export function drawBlock(block: JSONContent): DrawnBlock {
  if (block.type === "heading") return drawHeading(block);

  const body = document.createElement(TAGS[block.type ?? ""] ?? "p");
  return { elements: { flow: body, body }, release() {} };
}

/**
 * Draws the shell a block this plugin inserted stands in.
 *
 * There is no article markup to take over here, because the page was built
 * before the block existed, so ProseMirror draws the block itself and this is
 * only the place it goes. The outer wrapper is `display: contents`, which makes
 * it invisible to layout: what the article lays out is the block's own element,
 * exactly as if the build had written it.
 *
 * @example const { elements } = drawSolo(); after.flow.after(elements.flow);
 */
export function drawSolo(): DrawnBlock {
  const flow = document.createElement("div");
  flow.style.display = "contents";

  const body = document.createElement("div");
  flow.append(body);

  return { elements: { flow, body }, release() {} };
}

/**
 * Draws a copy of a block the editor cannot draw, by copying what the build drew.
 *
 * A fence went through Shiki, a table through the core's own frame, a figure is
 * hand-written SVG: none of it can be made again in the browser, and all of it
 * is already standing on the page. So a copy is the markup itself, cloned,
 * which is why a duplicated or dragged block looks identical to the original
 * rather than approximately like it.
 *
 * What a clone loses is whatever React bound to the real one, such as a code
 * block's copy button. It comes back when the page is saved and the site
 * rebuilds, at which point the copy is markup the build wrote like any other.
 *
 * @example const drawn = drawStill(figure); after.flow.after(drawn.elements.flow);
 */
export function drawStill(markup: HTMLElement): DrawnBlock {
  const flow = markup.cloneNode(true) as HTMLElement;

  for (const stamped of [flow, ...flow.querySelectorAll<HTMLElement>(`[${SOURCE_RANGE}]`)]) {
    stamped.removeAttribute(SOURCE_RANGE);
  }

  return { elements: { flow, body: flow }, release() {} };
}

const TAGS: Record<string, string> = {
  bulletList: "ul",
  orderedList: "ol",
  blockquote: "blockquote",
  horizontalRule: "hr",
};

function drawHeading(block: JSONContent): DrawnBlock {
  const level = numberIn(block.attrs?.level, 2, 4);
  const host = reactHost();

  flushSync(() => host.root.render(<Heading as={`h${level}` as "h2"} />));

  const body = host.element.querySelector<HTMLElement>(`h${level}`);
  if (body === null) throw new Error(`Heading ${level} did not render`);

  return { elements: { flow: host.element, body }, release: host.release };
}

function reactHost() {
  const element = document.createElement("div");
  element.style.display = "contents";
  const root = createRoot(element);

  return { element, root, release: () => unmountLater(root) };
}

function numberIn(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && value >= minimum && value <= maximum ? value : minimum;
}
