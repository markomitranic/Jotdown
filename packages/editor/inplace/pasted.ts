/**
 * Markdown read back into blocks, the way the page would have drawn them.
 *
 * Each block is read the way a recovered draft is, so a heading or a table
 * arrives as the same editable block the slash menu would have made. Front
 * matter is dropped, because the page already has its own.
 */

import { fromHtml } from "hast-util-from-html";
import { defaultHandlers, toMdast, type Handle } from "hast-util-to-mdast";
import type { Image, Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import { toString as plainText } from "mdast-util-to-string";
import { parseDocument } from "../markdown/parse";
import { printBlock } from "../markdown/fromProseMirror";
import { mdastToMarkdown } from "../markdown/pipeline";
import { planFor } from "./editor";
import type { BlockSnapshot } from "./handles";

/**
 * Every block a piece of markdown holds, ready to be put on the page.
 *
 * @example blocksFrom("## Title\n\nWords."); // [{ block: heading }, { block: paragraph }]
 */
export function blocksFrom(markdown: string): BlockSnapshot[] {
  return (parseDocument(markdown).doc.content ?? []).map((block) => {
    const planned = planFor(printBlock(block));
    return { block: planned?.block ?? block, anchor: planned?.anchor ?? "" };
  });
}

/**
 * HTML copied from another site as markdown, or null when it is only a line of words.
 *
 * Headings, paragraphs, lists, quotes, fences, tables and images keep their
 * shape. An image keeps the address it was copied from, for the paste to
 * download, unless it has none a browser could fetch. A run of words with no
 * block of its own is left to the editor's own paste, which keeps it inline
 * where the caret is.
 *
 * @example markdownFromHtml("<h1>Hello</h1><p>Words.</p>"); // "# Hello\n\nWords."
 * @example markdownFromHtml("<b>Bold</b> words"); // null
 */
export function markdownFromHtml(html: string): string | null {
  const tree = toMdast(fromHtml(html), { handlers: { img: image, b: bold } }) as Root;
  const blocks = tree.children.flatMap(liftImages).filter(hasContent);

  const inline = blocks.length === 1 && blocks[0]?.type === "paragraph";
  if (blocks.length === 0 || inline) return null;

  return blocks.map(mdastToMarkdown).join("\n\n");
}

/**
 * A paragraph with its pictures taken out to stand as blocks of their own, the words around them split in two.
 *
 * A page has no picture inside a line, so a logo inside a link, or an icon
 * between two words, would otherwise make the whole paragraph a block nobody
 * can edit.
 *
 * @example liftImages(paragraph("Before", image, "after")); // [paragraph("Before"), paragraph(image), paragraph("after")]
 */
function liftImages(block: RootContent): RootContent[] {
  if (block.type !== "paragraph") return [block];

  const lifted: Paragraph[] = [];
  let words: PhrasingContent[] = [];

  for (const child of block.children) {
    const picture = pictureIn(child);
    if (picture === null) {
      words.push(child);
      continue;
    }

    lifted.push(paragraphOf(words), { type: "paragraph", children: [picture] });
    words = [];
  }

  lifted.push(paragraphOf(words));
  return lifted;
}

/**
 * Words as a paragraph, without the space that stood between them and a picture taken out of the line.
 *
 * @example paragraphOf([text("Before ")]); // paragraph(text("Before"))
 */
function paragraphOf(words: PhrasingContent[]): Paragraph {
  const children = words.map((child, index) => {
    if (child.type !== "text") return child;

    const start = index === 0 ? child.value.trimStart() : child.value;
    return { ...child, value: index === words.length - 1 ? start.trimEnd() : start };
  });

  return { type: "paragraph", children };
}

/** The picture a piece of a line is, alone or as the only thing inside a link, or null. */
function pictureIn(child: PhrasingContent): Image | null {
  if (child.type === "image") return child;

  const [only] = child.type === "link" && child.children.length === 1 ? child.children : [];
  return only?.type === "image" ? only : null;
}

/** A block worth keeping: anything but a paragraph left with nothing in it, such as a spacer `<p><br></p>`. */
function hasContent(block: RootContent) {
  if (block.type !== "paragraph") return true;
  return plainText(block).trim() !== "" || block.children.some((child) => child.type === "image");
}

/** Addresses a paste can fetch an image from. */
export const DOWNLOADABLE = /^(?:https?:|data:image\/)/;

/**
 * An image a browser could download, and nothing for one it could not, such as a `blob:` of another tab.
 *
 * @example image(state, <img src="https://example.com/logo.png">); // { type: "image", url: "https://…" }
 */
const image: Handle = (state, element) => {
  const src = String(element.properties.src ?? "");
  return DOWNLOADABLE.test(src) ? defaultHandlers.img(state, element) : undefined;
};

/**
 * Bold, except the `<b>` Google Docs wraps around everything it copies, which is only its marker.
 *
 * @example bold(state, <b id="docs-internal-guid-1f2e">…</b>); // its children, unbolded
 */
const bold: Handle = (state, element) => {
  const marker = String(element.properties.id ?? "").startsWith("docs-internal-guid");
  return marker ? state.all(element) : defaultHandlers.b(state, element);
};
