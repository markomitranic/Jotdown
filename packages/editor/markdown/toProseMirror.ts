/**
 * mdast to ProseMirror JSON.
 *
 * The mapping is deliberately narrow. Anything outside it, an MDX element, a
 * footnote, becomes an inert block carrying its source verbatim, so a save can
 * never drop content the editor did not understand. That fallback is a `null`
 * return that bubbles up: a paragraph containing inline JSX makes the whole
 * paragraph inert, because there is no inline inert node to put the JSX in. A
 * table cell holding JSX takes the whole table inert with it for the same
 * reason.
 */

import type { JSONContent } from "@tiptap/core";
import type {
  AlignType,
  BlockContent,
  Code,
  DefinitionContent,
  Image,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Table,
  TableRow,
} from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import type { InertKind } from "../types";
import { nodeRange } from "./pipeline";
import { isWidth } from "@jotdown/core/lib/block-width";

type Mark = { type: string; attrs?: Record<string, unknown> };

type NestedContent = BlockContent | DefinitionContent;

/**
 * A JSX element at block level, `<VideoEmbed />`, `<LinkEmbed />` or `<FileAttachment />`.
 *
 * `remark-mdx` widens the mdast union with it, so the type is taken from there
 * rather than from a package the site does not depend on directly.
 */
type JsxFlowElement = Extract<RootContent, { type: "mdxJsxFlowElement" }>;

/**
 * Maps one mdast block to a ProseMirror node, or null when the editor schema
 * has no home for it. Callers at the top level turn null into `inertBlock`.
 */
export function blockToProseMirror(node: RootContent, source: string): JSONContent | null {
  switch (node.type) {
    case "paragraph":
      return paragraphToProseMirror(node);
    case "heading": {
      const content = phrasingToProseMirror(node.children);
      return content && { type: "heading", attrs: { level: node.depth }, content };
    }
    case "list":
      return listToProseMirror(node, source);
    case "code":
      return codeToProseMirror(node);
    case "blockquote": {
      const content = blocksToProseMirror(node.children, source);
      return content && { type: "blockquote", content };
    }
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "table":
      return tableToProseMirror(node);
    case "containerDirective":
      return admonitionToProseMirror(node, source);
    case "mdxJsxFlowElement":
      return jsxBlockToProseMirror(node, source);
    default:
      return null;
  }
}

/**
 * Wraps a block's verbatim source in an atom the editor renders as greyed-out,
 * uneditable text. On save it emits `source` unchanged, byte for byte.
 */
export function inertBlock(node: RootContent, source: string): JSONContent {
  const { srcStart, srcEnd } = nodeRange(node);
  return {
    type: "mdxBlock",
    attrs: { source: source.slice(srcStart, srcEnd), kind: inertKind(node) },
  };
}

function paragraphToProseMirror(node: Paragraph): JSONContent | null {
  const [only] = node.children;
  if (node.children.length === 1 && only?.type === "image") {
    return imageToProseMirror(only);
  }
  const content = phrasingToProseMirror(node.children);
  if (content === null) return null;
  return content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content };
}

/**
 * A code fence, with whatever followed its language kept as `meta`.
 *
 * `title="x"`, `lineNumbers` and `tab="npm"` all ride in that string and decide
 * how the built page frames the block, so it is carried whole and printed back
 * as it was rather than read into fields.
 */
function codeToProseMirror(node: Code): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: node.lang ?? null, meta: node.meta ?? null },
    content: node.value === "" ? undefined : [{ type: "text", text: node.value }],
  };
}

function listToProseMirror(node: List, source: string): JSONContent | null {
  const content: JSONContent[] = [];
  for (const item of node.children) {
    const mapped = listItemToProseMirror(item, source);
    if (mapped === null) return null;
    content.push(mapped);
  }
  const spread = node.spread === true;

  return node.ordered
    ? { type: "orderedList", attrs: { start: node.start ?? 1, spread }, content }
    : { type: "bulletList", attrs: { spread }, content };
}

function listItemToProseMirror(item: ListItem, source: string): JSONContent | null {
  const content = blocksToProseMirror(item.children, source);
  return (
    content && {
      type: "listItem",
      attrs: { spread: item.spread === true, checked: item.checked ?? null },
      content: orEmptyParagraph(content),
    }
  );
}

/**
 * Maps a GFM table to the editor's table nodes.
 *
 * Markdown gives a table one header row and no footer: the dashed line under
 * the first row is what makes the block a table at all, so the header is not
 * optional and there is nothing else to map. Column alignment rides on the
 * `align` attribute of every cell in the column rather than once on the table,
 * so inserting or deleting a column carries the alignment with it.
 *
 * Rows are padded out to the widest one. ProseMirror's table machinery assumes
 * a rectangle and repairs anything else on the first keystroke, which would
 * turn a one-cell edit to a ragged table into a rewrite of the whole block.
 */
function tableToProseMirror(node: Table): JSONContent | null {
  const width = Math.max(...node.children.map((row) => row.children.length), 0);
  if (width === 0) return null;

  const rows: JSONContent[] = [];

  for (const [index, row] of node.children.entries()) {
    const cells = rowToProseMirror(row, index === 0, width, node.align ?? []);
    if (cells === null) return null;
    rows.push({ type: "tableRow", content: cells });
  }

  return { type: "table", content: rows };
}

function rowToProseMirror(
  row: TableRow,
  header: boolean,
  width: number,
  align: readonly AlignType[],
): JSONContent[] | null {
  const cells: JSONContent[] = [];

  for (let column = 0; column < width; column += 1) {
    const content = phrasingToProseMirror(breaksFromJsx(row.children[column]?.children ?? []));
    if (content === null) return null;

    cells.push({
      type: header ? "tableHeader" : "tableCell",
      attrs: { align: align[column] ?? null },
      content: [content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content }],
    });
  }

  return cells;
}

/**
 * Reads `<br />` in a cell as a hard break.
 *
 * A row is one line of the file, so `<br />` is the only way to spell a line
 * break inside a cell, and the docs already use it that way. Left alone it is
 * inline JSX, and inline JSX takes the whole table inert with it.
 */
function breaksFromJsx(children: readonly PhrasingContent[]): PhrasingContent[] {
  return children.map((child) => (isLineBreak(child) ? { type: "break" } : child));
}

function isLineBreak(node: PhrasingContent) {
  return (
    node.type === "mdxJsxTextElement" &&
    node.name === "br" &&
    node.attributes.length === 0 &&
    node.children.length === 0
  );
}

/**
 * Maps a block-level component to its editor node.
 *
 * Only the tags listed here, spelled exactly as their node can hold them, are
 * editable. Everything else stays inert and comes back out of the file byte for
 * byte, which is what lets a page carry a component the editor has never heard
 * of without putting it at risk.
 *
 * The two cards are atoms, so anything between their tags means the file is
 * saying something the node cannot hold and the block goes inert.
 */
function jsxBlockToProseMirror(node: JsxFlowElement, source: string): JSONContent | null {
  switch (node.name) {
    case "Whiteboard": {
      const attributes = leafAttributes(node);
      if (!attributes || Object.keys(attributes).some((key) => !["src", "preview", "scene"].includes(key))) return null;
      return { type: "whiteboard", attrs: attributes };
    }
    case "VideoEmbed": {
      const attributes = leafAttributes(node);
      return attributes && videoEmbedToProseMirror(attributes);
    }
    case "LinkEmbed": {
      const attributes = leafAttributes(node);
      return attributes && linkEmbedToProseMirror(attributes);
    }
    case "FileAttachment": {
      const attributes = leafAttributes(node);
      return attributes && fileAttachmentToProseMirror(attributes);
    }
    case "Accordions":
      return accordionsToProseMirror(node, source);
    case "Steps":
      return stepsToProseMirror(node, source);
    case "Tabs":
      return tabsToProseMirror(node, source);
    case "Cards":
      return cardsToProseMirror(node);
    case "Files":
      return filesToProseMirror(node);
    default:
      return null;
  }
}

/** An atom's attributes, or null once the tag has anything between its tags. */
function leafAttributes(node: JsxFlowElement) {
  return node.children.length === 0 ? plainAttributes(node) : null;
}

/**
 * `<Accordions>` and the `<Accordion>` panels inside it.
 *
 * `defaultValue` is the core's name for the panel that starts expanded, matched
 * against a panel's title, and it moves onto that panel as `open`. Keeping it
 * on the wrapper would mean a writer renaming a title silently leaves the
 * wrapper pointing at a panel nobody can find. Anything else between the tags,
 * a stray paragraph or a component, takes the block inert.
 */
function accordionsToProseMirror(node: JsxFlowElement, source: string): JSONContent | null {
  const attributes = plainAttributes(node);
  if (attributes === null) return null;

  const { type, defaultValue, ...rest } = attributes;
  if (Object.keys(rest).length > 0) return null;
  if (node.children.length === 0) return null;

  const content: JSONContent[] = [];

  for (const child of node.children) {
    const panel = accordionToProseMirror(child, defaultValue, source);
    if (panel === null) return null;
    content.push(panel);
  }

  return { type: "accordions", attrs: { type: type ?? null }, content };
}

/** One `<Accordion title="…">`, whose body is ordinary prose. */
function accordionToProseMirror(
  node: NestedContent,
  defaultValue: string | undefined,
  source: string,
): JSONContent | null {
  if (node.type !== "mdxJsxFlowElement" || node.name !== "Accordion") return null;

  const attributes = plainAttributes(node);
  if (attributes === null) return null;

  const { title, id, ...rest } = attributes;
  if (title === undefined || Object.keys(rest).length > 0) return null;

  const content = blocksToProseMirror(node.children, source);
  if (content === null) return null;

  return {
    type: "accordion",
    attrs: { title, id: id ?? null, open: title === defaultValue },
    content: orEmptyParagraph(content),
  };
}

/**
 * `<Steps>` and the `<Step>` panels inside it.
 *
 * Neither tag takes a prop, so one carrying an attribute is saying something
 * the node cannot hold and the block goes inert. So does anything between the
 * tags that is not a step.
 */
function stepsToProseMirror(node: JsxFlowElement, source: string): JSONContent | null {
  if (node.attributes.length > 0 || node.children.length === 0) return null;

  const content: JSONContent[] = [];

  for (const child of node.children) {
    const step = stepToProseMirror(child, source);
    if (step === null) return null;
    content.push(step);
  }

  return { type: "steps", content };
}

/** One `<Step>`, whose body is ordinary prose. */
function stepToProseMirror(node: NestedContent, source: string): JSONContent | null {
  if (node.type !== "mdxJsxFlowElement" || node.name !== "Step") return null;
  if (node.attributes.length > 0) return null;

  const content = blocksToProseMirror(node.children, source);
  return content && { type: "step", content: orEmptyParagraph(content) };
}

/**
 * `<Tabs items={[…]}>` and the `<Tab>` panels inside it.
 *
 * The core names the tabs on the wrapper and matches each panel to one of those
 * names by its `value`, so a panel whose value is not in the list is one no
 * reader can ever open. The name moves onto the panel here and is printed back
 * from it, which is what makes renaming a tab a single edit. A wrapper whose
 * panels and names do not already line up is left inert rather than repaired,
 * because guessing which of the two the writer meant would be a rewrite.
 */
function tabsToProseMirror(node: JsxFlowElement, source: string): JSONContent | null {
  const labels = tabItems(node);
  if (labels === null || labels.length !== node.children.length) return null;

  const content: JSONContent[] = [];

  for (const [index, child] of node.children.entries()) {
    const label = labels[index];
    const tab = label === undefined ? null : tabToProseMirror(child, label, source);
    if (tab === null) return null;
    content.push(tab);
  }

  return { type: "tabs", content };
}

/**
 * One `<Tab>`, which either names the label it belongs to or leaves it to its
 * position. A `value` naming a different label takes the block inert.
 */
function tabToProseMirror(node: NestedContent, label: string, source: string): JSONContent | null {
  if (node.type !== "mdxJsxFlowElement" || node.name !== "Tab") return null;

  const attributes = plainAttributes(node);
  if (attributes === null) return null;

  const { value, ...rest } = attributes;
  if (Object.keys(rest).length > 0) return null;
  if (value !== undefined && value !== label) return null;

  const content = blocksToProseMirror(node.children, source);
  return (
    content && {
      type: "tab",
      attrs: { label },
      content: orEmptyParagraph(content),
    }
  );
}

/** The labels in `items={['bun', 'npm']}`, or null for any other spelling. */
function tabItems(node: JsxFlowElement): string[] | null {
  const [items, ...rest] = node.attributes;
  if (rest.length > 0) return null;
  if (items?.type !== "mdxJsxAttribute" || items.name !== "items") return null;

  const expression = items.value;
  if (typeof expression !== "object" || expression === null) return null;

  return stringArray(expression.value);
}

/**
 * The strings in a JS array literal, or null when it holds anything else.
 *
 * Only what a writer can mean by a list of labels is accepted: quoted strings
 * with no escape in them. A computed item, a template literal, a trailing comma
 * or an empty list all take the block inert instead of being guessed at.
 *
 * @example stringArray("['bun', 'npm']"); // ["bun", "npm"]
 */
function stringArray(expression: string): string[] | null {
  const text = expression.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return null;

  const labels: string[] = [];
  let rest = text.slice(1, -1).trim();

  for (;;) {
    const literal = /^(?:'([^'\\]*)'|"([^"\\]*)")/.exec(rest);
    if (literal === null) return null;

    labels.push(literal[1] ?? literal[2] ?? "");
    rest = rest.slice(literal[0].length).trim();

    if (rest === "") return labels;
    if (!rest.startsWith(",")) return null;
    rest = rest.slice(1).trim();
  }
}

/**
 * `<Cards>` and the `<Card />` leaves in it.
 *
 * A card is three short strings, so it is read as attributes rather than as a
 * container. the core also renders whatever sits between a card's tags, and a
 * card with anything there takes the block inert rather than losing it.
 */
function cardsToProseMirror(node: JsxFlowElement): JSONContent | null {
  if (node.attributes.length > 0 || node.children.length === 0) return null;

  const content: JSONContent[] = [];

  for (const child of node.children) {
    const card = cardToProseMirror(child);
    if (card === null) return null;
    content.push(card);
  }

  return { type: "cards", content };
}

/**
 * One `<Card title="…" description="…" href="…" />`.
 *
 * None of the three has to be there. An `icon` is an expression rather than a
 * string, so a card carrying one goes inert with its block, and so does any
 * other prop.
 */
function cardToProseMirror(node: NestedContent): JSONContent | null {
  if (node.type !== "mdxJsxFlowElement" || node.name !== "Card") return null;

  const attributes = leafAttributes(node);
  if (attributes === null) return null;

  const { title, description, href, ...rest } = attributes;
  if (Object.keys(rest).length > 0) return null;

  return {
    type: "card",
    attrs: { title: title ?? "", description: description ?? "", href: href ?? "" },
  };
}

/**
 * `<Files>` and the tree of `<File />` and `<Folder>` rows in it.
 *
 * The wrapper takes no prop and no row holds prose, so the whole block is names
 * and nesting. A paragraph between the rows, or an `icon` on one of them, takes
 * it inert.
 */
function filesToProseMirror(node: JsxFlowElement): JSONContent | null {
  if (node.attributes.length > 0) return null;

  const content = entriesToProseMirror(node.children);
  if (content === null || content.length === 0) return null;

  return { type: "files", content };
}

/** The rows at one level of the tree, each folder recursing into its own. */
function entriesToProseMirror(nodes: readonly NestedContent[]): JSONContent[] | null {
  const content: JSONContent[] = [];

  for (const child of nodes) {
    if (child.type !== "mdxJsxFlowElement") return null;

    if (child.name === "File") {
      const attributes = leafAttributes(child);
      if (attributes === null) return null;

      const { name, ...rest } = attributes;
      if (Object.keys(rest).length > 0) return null;

      content.push({ type: "file", attrs: { name: name ?? "" } });
      continue;
    }

    if (child.name === "Folder") {
      const attrs = folderAttributes(child);
      const nested = entriesToProseMirror(child.children);
      if (attrs === null || nested === null) return null;

      content.push({ type: "folder", attrs, content: nested });
      continue;
    }

    return null;
  }

  return content;
}

/**
 * A `<Folder>`'s name, and whether it greets the reader open.
 *
 * `defaultOpen` is written as a bare attribute with no value, which is the one
 * place this bridge reads one: `plainAttributes` refuses them, because for
 * every other tag here a valueless prop means the file is saying something an
 * attribute map cannot carry. Any other spelling of it goes inert.
 */
function folderAttributes(node: JsxFlowElement): { name: string; open: boolean } | null {
  let name = "";
  let open = false;

  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute") return null;

    if (attribute.name === "name" && typeof attribute.value === "string") {
      name = attribute.value;
      continue;
    }

    if (attribute.name === "defaultOpen" && attribute.value === null) {
      open = true;
      continue;
    }

    return null;
  }

  return { name, open };
}

/**
 * A JSX element's attributes as plain strings, or null if any is not one.
 *
 * An expression value, `url={link}`, a spread, `{...props}`, or a bare boolean
 * attribute all mean the file is saying something an attribute map cannot
 * carry, so the block goes inert rather than being rewritten into something
 * simpler than what was there.
 */
function plainAttributes(node: JsxFlowElement): Record<string, string> | null {
  const attributes: Record<string, string> = {};

  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute") return null;
    if (typeof attribute.value !== "string") return null;
    attributes[attribute.name] = attribute.value;
  }

  return attributes;
}

/** `<VideoEmbed url="…" />`. An unknown attribute takes the block inert. */
function videoEmbedToProseMirror(attributes: Record<string, string>): JSONContent | null {
  const { url, ...rest } = attributes;
  if (url === undefined || Object.keys(rest).length > 0) return null;

  return { type: "videoEmbed", attrs: { url } };
}

/**
 * `<LinkEmbed url="…" title="…" … />`.
 *
 * Only `url` has to be there. The rest were read off the page when the link
 * was pasted, and a tag missing one draws the card without it.
 */
function linkEmbedToProseMirror(attributes: Record<string, string>): JSONContent | null {
  const { url, title, description, site, image, favicon, ...rest } = attributes;
  if (url === undefined || Object.keys(rest).length > 0) return null;

  return {
    type: "linkEmbed",
    attrs: {
      url,
      title: title ?? "",
      description: description ?? "",
      site: site ?? "",
      image: image ?? "",
      favicon: favicon ?? "",
    },
  };
}

/**
 * `<FileAttachment href="…" name="…" … />`.
 *
 * Only `href` has to be there: it is the one thing the card cannot be drawn
 * without. The rest are facts captured when the file was uploaded, and a tag
 * missing one shows the card without it rather than going inert over it.
 */
function fileAttachmentToProseMirror(attributes: Record<string, string>): JSONContent | null {
  const { href, name, size, uploadedAt, note, ...rest } = attributes;
  if (href === undefined || Object.keys(rest).length > 0) return null;

  return {
    type: "fileAttachment",
    attrs: {
      href,
      name: name ?? "",
      size: size ?? "",
      uploadedAt: uploadedAt ?? "",
      note: note ?? "",
    },
  };
}

/**
 * Maps a `:::note` container directive to the `admonition` node.
 *
 * Directive attributes, `:::note{#anchor}`, have no attr on the node, so a
 * directive carrying any goes inert rather than losing them. The
 * `:::warning[Required]` label arrives as a first paragraph child flagged
 * `directiveLabel`, and becomes the `title` attr. A `:::wide` or `:::full` is a
 * block's width rather than a callout, and only means something around a block
 * of the article, which takes it off before the block gets here, so one met
 * anywhere else goes inert and keeps its bytes.
 */
function admonitionToProseMirror(node: ContainerDirective, source: string): JSONContent | null {
  if (isWidth(node) || Object.keys(node.attributes ?? {}).length > 0) return null;

  const [first, ...rest] = node.children;
  const labelled = first?.type === "paragraph" && first.data?.directiveLabel === true;

  const title = labelled ? plainText(first) : null;
  if (labelled && title === null) return null;

  const content = blocksToProseMirror(labelled ? rest : node.children, source);
  if (content === null) return null;

  return {
    type: "admonition",
    attrs: { kind: node.name, title },
    content: orEmptyParagraph(content),
  };
}

/**
 * The label text of a directive, or null when it holds anything but plain text.
 * A formatted label has nowhere to go in a string attr, so its block goes inert.
 */
function plainText(node: Paragraph): string | null {
  if (!node.children.every((child) => child.type === "text")) return null;
  return node.children.map((child) => child.value).join("");
}

function blocksToProseMirror(nodes: readonly NestedContent[], source: string): JSONContent[] | null {
  const content: JSONContent[] = [];
  for (const node of nodes) {
    const mapped = blockToProseMirror(node, source);
    if (mapped === null) return null;
    content.push(mapped);
  }
  return content;
}

/** ProseMirror requires at least one block inside a list item or container. */
function orEmptyParagraph(content: JSONContent[]) {
  return content.length === 0 ? [{ type: "paragraph" }] : content;
}

function phrasingToProseMirror(nodes: readonly PhrasingContent[], marks: Mark[] = []): JSONContent[] | null {
  const content: JSONContent[] = [];

  for (const node of nodes) {
    const abbr = asAbbrElement(node);
    if (abbr) {
      const nested = phrasingToProseMirror(abbr.children, [...marks, { type: "abbr", attrs: { title: abbr.title } }]);
      if (nested === null) return null;
      content.push(...nested);
      continue;
    }

    switch (node.type) {
      case "text": {
        const value = unwrap(node.value);
        if (value !== "") content.push(textNode(value, marks));
        break;
      }
      case "inlineCode": {
        content.push(textNode(node.value, [...marks, { type: "code" }]));
        break;
      }
      case "strong":
      case "emphasis":
      case "delete": {
        const nested = phrasingToProseMirror(node.children, [...marks, { type: inlineMarkNames[node.type] }]);
        if (nested === null) return null;
        content.push(...nested);
        break;
      }
      case "link": {
        const nested = phrasingToProseMirror(node.children, [
          ...marks,
          { type: "link", attrs: { href: node.url, title: node.title ?? null } },
        ]);
        if (nested === null) return null;
        content.push(...nested);
        break;
      }
      case "break": {
        content.push({ type: "hardBreak" });
        break;
      }
      default:
        return null;
    }
  }

  return content;
}

/**
 * Extracts an `<abbr>` element from a phrasing node, or null if it isn't one.
 *
 * MDX parses `<abbr title="...">text</abbr>` as a `mdxJsxTextElement`. This
 * function picks out just `<abbr>` so the surrounding block stays editable
 * instead of going inert over a tooltip.
 */
function asAbbrElement(node: PhrasingContent): { title: string | null; children: PhrasingContent[] } | null {
  if (node.type !== "mdxJsxTextElement" || node.name !== "abbr") return null;

  const titleAttr = (node.attributes as { type: string; name: string; value: unknown }[]).find(
    (a) => a.type === "mdxJsxAttribute" && a.name === "title",
  );

  return {
    title: typeof titleAttr?.value === "string" ? titleAttr.value : null,
    children: node.children as PhrasingContent[],
  };
}

const inlineMarkNames = {
  strong: "bold",
  emphasis: "italic",
  delete: "strike",
} as const;

/**
 * Collapses the source's hard wrapping into the spaces markdown reads it as.
 *
 * Left as newlines, they end up in the ProseMirror text node, and the moment a
 * keystroke makes the view re-read that region of the DOM, prosemirror-model
 * turns each one into a hard break because Tiptap's `hardBreak` claims the
 * `linebreakReplacement` role. The paragraph then saves back with a trailing
 * backslash on every line, which renders as forced breaks on the page.
 *
 * @example unwrap("a line\nand the next"); // "a line and the next"
 */
function unwrap(text: string): string {
  return text.replace(/\r?\n/g, " ");
}

function textNode(text: string, marks: Mark[]): JSONContent {
  return marks.length === 0 ? { type: "text", text } : { type: "text", text, marks };
}

function imageToProseMirror(node: Image): JSONContent {
  return {
    type: "image",
    attrs: { src: node.url, alt: node.alt ?? null, title: node.title ?? null },
  };
}

/**
 * Labels an inert block by the first MDX-ish node in it, so the editor can say
 * "import" rather than "unknown" for a block that only failed to map because of
 * one inline element buried inside it.
 */
/**
 * A flow-level JSX element whose tag starts lowercase, like `<svg>` or
 * `<figure>`. These are native HTML and can be rendered visually in the editor
 * instead of shown as source code.
 */
function isNativeElement(node: RootContent): boolean {
  return node.type === "mdxJsxFlowElement" && typeof node.name === "string" && /^[a-z]/.test(node.name);
}

function inertKind(node: RootContent): InertKind {
  if (isNativeElement(node)) return "native";

  const kind = mdxKinds[node.type as keyof typeof mdxKinds];
  if (kind) return kind;

  if ("children" in node) {
    for (const child of node.children) {
      const nested = inertKind(child);
      if (nested !== "unknown") return nested;
    }
  }

  return "unknown";
}

const mdxKinds = {
  mdxjsEsm: "esm",
  mdxJsxFlowElement: "jsx",
  mdxJsxTextElement: "jsx",
  mdxFlowExpression: "expression",
  mdxTextExpression: "expression",
  html: "html",
} as const satisfies Record<string, InertKind>;
