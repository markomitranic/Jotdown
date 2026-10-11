/**
 * Whole blocks on the clipboard: markdown for anywhere, HTML for a mail, and an exact copy for here.
 *
 * Markdown is what a block is, so it goes on the clipboard as plain text and
 * pastes into a terminal, an issue or an agent's prompt exactly as written.
 * HTML goes beside it for the places that format what they are handed.
 *
 * The HTML carries a mark that says these are blocks copied from the studio,
 * since a clipboard type of our own does not survive the system clipboard on a
 * Mac. Pasted back in the same tab the blocks themselves come back, markup and
 * all, so a fence lands highlighted and a figure lands drawn; in another tab
 * the mark says to read the markdown back into the same blocks.
 */

import type { BlockOps, BlockSnapshot } from "./handles";

/** The attribute on the copied HTML that says the clipboard holds blocks. */
const MARK = "data-jotdown-blocks";

/** The blocks this tab last put on the clipboard, and the markdown they went as. */
let carried: { markdown: string; blocks: BlockSnapshot[] } | null = null;

/**
 * Puts whole blocks on a clipboard event's data, in every form a paste target might want.
 *
 * The markup a block carries is cloned now, because a cut hides the original
 * before anything is pasted.
 *
 * @example writeBlocks(event.clipboardData, page.blocks.get());
 */
export function writeBlocks(data: DataTransfer, blocks: readonly BlockOps[]) {
  const markdown = markdownOf(blocks);

  data.setData("text/plain", markdown);
  data.setData("text/html", `<div ${MARK}>${blocks.map(plainHtml).join("\n")}</div>`);

  carried = { markdown, blocks: blocks.map(carry) };
}

/**
 * The markdown of blocks copied from the studio, when that is what a clipboard holds, or null for anything else.
 *
 * Line endings are put back to the ones the markdown was written with, which
 * Windows changes on the way through.
 *
 * @example copiedMarkdown(event.clipboardData); // "## Title\n\nWords."
 */
export function copiedMarkdown(data: DataTransfer): string | null {
  const markdown = data.getData("text/plain").replace(/\r\n/g, "\n");
  const marked = data.getData("text/html").includes(MARK) || markdown === carried?.markdown;

  return marked && markdown !== "" ? markdown : null;
}

/**
 * The blocks this tab copied, when a clipboard holds exactly those, ready to be put down.
 *
 * Every call hands out fresh copies, so pasting twice puts down two sets of blocks.
 *
 * @example carriedBlocks("## Title\n\nWords."); // [{ block, anchor, markup }, …]
 */
export function carriedBlocks(markdown: string): BlockSnapshot[] | null {
  if (carried === null || carried.markdown !== markdown) return null;
  return carried.blocks.map(carry);
}

/**
 * Several blocks as one piece of markdown, a blank line between each.
 *
 * @example markdownOf([heading, paragraph]); // "## Title\n\nWords."
 */
export function markdownOf(blocks: readonly BlockOps[]): string {
  return blocks
    .map((block) => block.markdown())
    .filter((markdown) => markdown !== "")
    .join("\n\n");
}

/**
 * A block as formatted text, for pasting into a mail, a chat or a document.
 *
 * The block's own element is copied and stripped of everything the editor and
 * the page's styling hung on it, along with its buttons, so what arrives is
 * plain tags a paste target can style its own way.
 *
 * @example plainHtml(paragraph); // "<p>Words with <strong>weight</strong>.</p>"
 */
export function plainHtml(block: BlockOps): string {
  const copy = block.dom.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("button").forEach((button) => button.remove());

  for (const element of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    for (const name of element.getAttributeNames()) {
      const dropped = EDITOR_ATTRIBUTES.includes(name) || name.startsWith("data-") || name.startsWith("aria-");
      if (dropped) element.removeAttribute(name);
    }
  }

  return copy.outerHTML;
}

/** Attributes the editor puts on a block that mean nothing once it leaves the page. */
const EDITOR_ATTRIBUTES = [
  "contenteditable",
  "spellcheck",
  "translate",
  "draggable",
  "class",
  "style",
  "role",
  "tabindex",
];

function carry(block: BlockOps | BlockSnapshot): BlockSnapshot {
  const snapshot = "snapshot" in block ? block.snapshot() : block;

  return {
    block: structuredClone(snapshot.block),
    anchor: snapshot.anchor,
    markup: snapshot.markup?.cloneNode(true) as HTMLElement | undefined,
  };
}
