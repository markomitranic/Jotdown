/**
 * How wide a block of the article stands: the column, wider than it, or the whole page.
 *
 * A width is written as a directive around one block, and no wrapper is the
 * column, so a page that never widens anything carries nothing extra:
 *
 *     :::wide
 *
 *     | Product | Purpose |
 *     | --- | --- |
 *
 *     :::
 *
 * Only a table or an image at the top level of the article widens. Anywhere
 * else, or around anything else, the wrapper is dropped and its content reads
 * at the column's width, so a width that cannot apply is never an error.
 */

import type { Paragraph, Root, RootContent, Table } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import type {} from "mdast-util-to-hast";

export type BlockWidth = "normal" | "wide" | "full";

/** The prop a widened block arrives in the browser with. */
export const WIDTH = "data-block-width";

type Wider = Exclude<BlockWidth, "normal">;

type Branch = { type: string; children?: Branch[] };

type Widenable = Table | Paragraph;

/**
 * Whether a directive is one of the two widths rather than a callout or a stray colon.
 *
 * @example isWidth({ type: "containerDirective", name: "wide" }); // true
 */
export function isWidth(node: { type: string; name?: string }): node is ContainerDirective & { name: Wider } {
  return node.type === "containerDirective" && (node.name === "wide" || node.name === "full");
}

/**
 * Takes a top-level width off a block's markdown, leaving the block as it would read unwidened.
 *
 * @example peelWidth(":::full\n\n![Map](/map.png)\n\n:::"); // { width: "full", inner: "![Map](/map.png)" }
 * @example peelWidth("Plain words."); // { width: "normal", inner: "Plain words." }
 */
export function peelWidth(markdown: string): { width: BlockWidth; inner: string } {
  const wrapped = /^:::(wide|full)[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/.exec(markdown);
  if (!wrapped) return { width: "normal", inner: markdown };

  const [, width = "wide", inner = ""] = wrapped;
  return {
    width: width as Wider,
    inner: inner.replace(/^(?:[ \t]*\r?\n)+/, "").replace(/(?:\r?\n[ \t]*)+$/, ""),
  };
}

/**
 * Puts a width back around a block's markdown, or leaves it bare at the column's width.
 *
 * @example wrapWidth("| a |\n| - |", "wide"); // ":::wide\n\n| a |\n| - |\n\n:::"
 * @example wrapWidth("Plain words.", "normal"); // "Plain words."
 */
export function wrapWidth(markdown: string, width: BlockWidth): string {
  if (width === "normal" || markdown === "") return markdown;

  return `:::${width}\n\n${markdown}\n\n:::`;
}

/**
 * Hands each width to the block it wraps, and drops every width that cannot apply.
 *
 * The wrapper leaves the tree and the block takes its place, its position and
 * a `data-block-width` prop, so the browser sees the same table or image as ever
 * with one attribute more, and the stamp an editor splices by covers the
 * wrapper's lines too. Runs before the source range is stamped.
 */
export function remarkBlockWidth() {
  return (tree: Root) => {
    settle(tree as Branch, true);
  };
}

function settle(parent: Branch, topLevel: boolean) {
  if (!parent.children) return;

  parent.children = parent.children.flatMap((child) => {
    if (!isWidth(child)) {
      settle(child, false);
      return [child];
    }

    const [only, ...rest] = child.children;
    if (topLevel && only !== undefined && rest.length === 0 && widenable(only)) {
      return [widened(only, child)];
    }

    const inside = { type: child.type, children: child.children as Branch[] };
    settle(inside, topLevel);
    return inside.children;
  });
}

/** A table, or a paragraph holding nothing but one image. */
function widenable(node: RootContent): node is Widenable {
  if (node.type === "table") return true;

  return node.type === "paragraph" && node.children.length === 1 && node.children[0]?.type === "image";
}

function widened(block: Widenable, wrapper: ContainerDirective & { name: Wider }): Branch {
  block.position = wrapper.position;
  block.data = { ...block.data, hProperties: { ...block.data?.hProperties, [WIDTH]: wrapper.name } };

  return block;
}
