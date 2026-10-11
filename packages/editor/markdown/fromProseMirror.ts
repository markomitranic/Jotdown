/**
 * ProseMirror JSON back to mdast, and from there to markdown text.
 *
 * Inline formatting is the interesting half. ProseMirror flattens marks onto
 * text nodes, mdast nests them, so adjacent text sharing a mark has to be
 * regrouped or `**a****b**` comes out instead of `**ab**`. Marks are sorted
 * into one fixed order first, which also keeps the nesting stable across saves.
 */

import { whiteboardData, whiteboardMarkdown } from "@jotdown/core/components/blocks/whiteboard/model";
import type { JSONContent } from "@tiptap/core";
import type { ContainerDirective } from "mdast-util-directive";
import type { AlignType, BlockContent, DefinitionContent, Paragraph, PhrasingContent, RootContent, Table } from "mdast";
import { mdastToMarkdown } from "./pipeline";

type Mark = { type: string; attrs?: Record<string, unknown> };

type Leaf = { node: JSONContent; marks: Mark[] };

/**
 * Prints one top-level editor block as markdown, with no trailing newline.
 *
 * This is the single measure of what a block "currently is". Parsing records
 * its output per block, and saving compares against that record to decide
 * verbatim splice versus re-serialise, so both sides must call this.
 */
export function printBlock(node: JSONContent): string {
  return mdastToMarkdown(blockToMdast(node));
}

/**
 * Maps one editor block back to mdast.
 *
 * Inert blocks become an mdast `html` node, whose serialiser emits `value`
 * untouched. That is how a JSX element survives a save without ever going
 * through the MDX serialiser, which would renormalise its quoting.
 */
export function blockToMdast(node: JSONContent): RootContent {
  switch (node.type) {
    case "whiteboard":
      return { type: "html", value: whiteboardMarkdown(whiteboardData(node.attrs)) };
    case "paragraph":
      return { type: "paragraph", children: inlineToMdast(node.content) };
    case "heading":
      return {
        type: "heading",
        depth: headingDepth(node.attrs?.level),
        children: inlineToMdast(node.content),
      };
    case "bulletList":
      return {
        type: "list",
        ordered: false,
        spread: node.attrs?.spread === true,
        children: listItems(node.content),
      };
    case "orderedList":
      return {
        type: "list",
        ordered: true,
        start: numberOr(node.attrs?.start, 1),
        spread: node.attrs?.spread === true,
        children: listItems(node.content),
      };
    case "codeBlock":
      return {
        type: "code",
        lang: stringOrNull(node.attrs?.language),
        meta: stringOrNull(node.attrs?.meta),
        value: textOf(node.content),
      };
    case "blockquote":
      return { type: "blockquote", children: nestedBlocks(node.content) };
    case "horizontalRule":
      return { type: "thematicBreak" };
    case "image":
      return { type: "paragraph", children: [imageToMdast(node)] };
    case "table":
      return tableToMdast(node);
    case "admonition":
      return admonitionToMdast(node);
    case "accordions":
      return accordionsToMdast(node);
    case "steps":
      return stepsToMdast(node);
    case "tabs":
      return tabsToMdast(node);
    case "cards":
      return cardsToMdast(node);
    case "files":
      return filesToMdast(node);
    case "mdxBlock":
      return { type: "html", value: stringOrNull(node.attrs?.source) ?? "" };
    case "videoEmbed":
      return videoEmbedToMdast(node);
    case "linkEmbed":
      return linkEmbedToMdast(node);
    case "fileAttachment":
      return fileAttachmentToMdast(node);
    default:
      throw new Error(`live-edit: no markdown mapping for node "${node.type}"`);
  }
}

/**
 * Prints the video block back as the tag the file spells it with.
 *
 * A block with no link prints as nothing, and `serializeDocument` drops empty
 * pieces, so a video somebody started inserting and then walked away from
 * leaves no trace in the file.
 */
function videoEmbedToMdast(node: JSONContent): RootContent {
  const url = stringOrNull(node.attrs?.url) ?? "";
  return {
    type: "html",
    value: url === "" ? "" : `<VideoEmbed${printedAttributes({ url })} />`,
  };
}

/**
 * ` name="value"` for each value that has one, ready to sit inside a tag.
 *
 * Only the quote that would end the attribute is escaped. A bare `&` is legal
 * in a JSX attribute and is how anyone writing `?v=x&t=42` by hand spells it,
 * so escaping that too would rewrite a link the first time its block was
 * touched, for no gain.
 *
 * @example printedAttributes({ title: "Home", href: "" }); // ' title="Home"'
 */
function printedAttributes(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== "")
    .map(([name, value]) => ` ${name}="${value.replace(/"/g, "&quot;")}"`)
    .join("");
}

/** Printed in this order, so a re-serialised card always reads the same way. */
const FILE_ATTRIBUTES = ["href", "name", "size", "uploadedAt", "note"];
const LINK_ATTRIBUTES = ["url", "title", "description", "site", "image", "favicon"];

/**
 * Prints the attachment back as the tag the file spells it with.
 *
 * A card with no link prints as nothing, and `serializeDocument` drops empty
 * pieces, so an upload somebody cancelled leaves no trace in the file.
 */
function fileAttachmentToMdast(node: JSONContent): RootContent {
  return { type: "html", value: tagOf("FileAttachment", node, FILE_ATTRIBUTES) };
}

/**
 * Prints the link card back as the tag the file spells it with.
 *
 * A card with no link prints as nothing, so one inserted from the slash menu
 * and walked away from leaves no trace in the file.
 */
function linkEmbedToMdast(node: JSONContent): RootContent {
  return { type: "html", value: tagOf("LinkEmbed", node, LINK_ATTRIBUTES) };
}

/**
 * A card's tag, one attribute to a line, or nothing once its first attribute is empty.
 *
 * One to a line, because a note or a description runs to a few hundred
 * characters and five of them on one line is a diff nobody can read. An empty
 * one is left off rather than written out as `note=""`.
 *
 * @example tagOf("LinkEmbed", node, ["url", "title"]); // '<LinkEmbed\n  url="…"\n  title="…"\n/>'
 */
function tagOf(name: string, node: JSONContent, order: readonly string[]): string {
  if (attributeOf(node, order[0] ?? "") === "") return "";

  const attributes = order.flatMap((attribute) => {
    const value = attributeOf(node, attribute);
    return value === "" ? [] : [`  ${attribute}="${value.replace(/"/g, "&quot;")}"`];
  });

  return `<${name}\n${attributes.join("\n")}\n/>`;
}

function attributeOf(node: JSONContent, name: string) {
  return (stringOrNull(node.attrs?.[name]) ?? "").trim();
}

/**
 * Prints the editor's table as a GFM table.
 *
 * Alignment is read off the header row, because that is the only place markdown
 * keeps it: one marker per column in the dashed line. Cell spans are ignored
 * rather than expanded. Nothing in the editor creates them, and a table pasted
 * in from a web page should lose its merged cells rather than the save.
 */
function tableToMdast(node: JSONContent): Table {
  const rows = node.content ?? [];

  return {
    type: "table",
    align: (rows[0]?.content ?? []).map((cell) => alignOf(cell.attrs?.align)),
    children: rows.map((row) => ({
      type: "tableRow",
      children: (row.content ?? []).map((cell) => ({
        type: "tableCell",
        children: cellToMdast(cell),
      })),
    })),
  };
}

/** A cell holds one paragraph, which is all a row of markdown has room for. */
function cellToMdast(cell: JSONContent): PhrasingContent[] {
  const [paragraph] = cell.content ?? [];
  return breaksToJsx(inlineToMdast(paragraph?.content));
}

/**
 * Prints a hard break inside a cell as `<br />`.
 *
 * Markdown's own hard break is a newline, and a newline would end the row.
 */
function breaksToJsx(nodes: PhrasingContent[]): PhrasingContent[] {
  return nodes.map((node) => {
    if (node.type === "break") return { type: "html", value: "<br />" };
    if (!("children" in node)) return node;
    return { ...node, children: breaksToJsx(node.children as PhrasingContent[]) };
  }) as PhrasingContent[];
}

const alignments: readonly AlignType[] = ["left", "center", "right"];

function alignOf(value: unknown): AlignType {
  return alignments.includes(value as AlignType) ? (value as AlignType) : null;
}

function admonitionToMdast(node: JSONContent): ContainerDirective {
  const title = stringOrNull(node.attrs?.title);
  const label: Paragraph[] =
    title === null
      ? []
      : [
          {
            type: "paragraph",
            data: { directiveLabel: true },
            children: [{ type: "text", value: title }],
          },
        ];

  return {
    type: "containerDirective",
    name: stringOrNull(node.attrs?.kind) ?? "note",
    attributes: {},
    children: [...label, ...nestedBlocks(node.content)],
  };
}

/**
 * Prints the panels back as `<Accordions>`, `defaultValue` included.
 *
 * The tags go through the MDX serialiser rather than out as a hand-built
 * string, which is what lets a panel hold ordinary markdown: it indents each
 * child two spaces and reparses to the same tree. Which panel starts open is
 * the panel's `open` attribute in the editor and the wrapper's `defaultValue`
 * in the file, so the two are translated here rather than kept in step.
 */
function accordionsToMdast(node: JSONContent): RootContent {
  const panels = node.content ?? [];
  const open = panels.find((panel) => panel.attrs?.open === true);

  return {
    type: "mdxJsxFlowElement",
    name: "Accordions",
    attributes: jsxAttributes({
      type: stringOrNull(node.attrs?.type),
      defaultValue: open === undefined ? null : stringOrNull(open.attrs?.title),
    }),
    children: panels.map(accordionToMdast),
  };
}

function accordionToMdast(node: JSONContent): BlockContent {
  return {
    type: "mdxJsxFlowElement",
    name: "Accordion",
    attributes: jsxAttributes({
      title: stringOrNull(node.attrs?.title) ?? "",
      id: stringOrNull(node.attrs?.id),
    }),
    children: nestedBlocks(node.content),
  };
}

/**
 * Prints the steps back as `<Steps>`, which is all there is to it: neither tag
 * takes a prop, so the block is its steps and the order they are in.
 */
function stepsToMdast(node: JSONContent): RootContent {
  return {
    type: "mdxJsxFlowElement",
    name: "Steps",
    attributes: [],
    children: (node.content ?? []).map(stepToMdast),
  };
}

function stepToMdast(node: JSONContent): BlockContent {
  return {
    type: "mdxJsxFlowElement",
    name: "Step",
    attributes: [],
    children: nestedBlocks(node.content),
  };
}

/**
 * Prints the tabs back as `<Tabs>`, with `items` built from their labels.
 *
 * The core draws the bar from `items` and matches a panel to a name by its
 * `value`, so both come off the same label here and the two cannot disagree.
 */
function tabsToMdast(node: JSONContent): RootContent {
  const tabs = node.content ?? [];
  const labels = tabs.map((tab) => stringOrNull(tab.attrs?.label) ?? "");

  return {
    type: "mdxJsxFlowElement",
    name: "Tabs",
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "items",
        value: {
          type: "mdxJsxAttributeValueExpression",
          value: itemsArray(labels),
        },
      },
    ],
    children: tabs.map((tab, index) => tabToMdast(tab, labels[index] ?? "")),
  };
}

function tabToMdast(node: JSONContent, label: string): BlockContent {
  return {
    type: "mdxJsxFlowElement",
    name: "Tab",
    attributes: jsxAttributes({ value: label }),
    children: nestedBlocks(node.content),
  };
}

/**
 * Prints the cards back as `<Cards>`, one card to a line.
 *
 * Hand-printed rather than built as mdast, because the MDX serialiser puts a
 * blank line between sibling elements. A card is one line and a set of them
 * reads as a list, so those blank lines would double the block's height in the
 * file for nothing. Nothing here holds prose, so there is no markdown to
 * indent and no reason to go through the serialiser.
 */
function cardsToMdast(node: JSONContent): RootContent {
  const cards = (node.content ?? []).map(
    (card) =>
      `  <Card${printedAttributes({
        title: attributeOf(card, "title"),
        description: attributeOf(card, "description"),
        href: attributeOf(card, "href"),
      })} />`,
  );

  return { type: "html", value: ["<Cards>", ...cards, "</Cards>"].join("\n") };
}

/**
 * Prints the tree back as `<Files>`, two spaces of indent to a level.
 *
 * Hand-printed for the reason the cards are, and more so: a blank line between
 * every row would make a ten-file tree unreadable in the file.
 */
function filesToMdast(node: JSONContent): RootContent {
  return {
    type: "html",
    value: ["<Files>", ...entryLines(node.content, 1), "</Files>"].join("\n"),
  };
}

/** The rows at one level, each folder printing the level beneath it. */
function entryLines(content: JSONContent[] | undefined, depth: number): string[] {
  const indent = "  ".repeat(depth);

  return (content ?? []).flatMap((entry) => {
    const name = printedAttributes({ name: attributeOf(entry, "name") });

    if (entry.type === "file") return [`${indent}<File${name} />`];

    const open = entry.attrs?.open === true ? " defaultOpen" : "";

    return [`${indent}<Folder${name}${open}>`, ...entryLines(entry.content, depth + 1), `${indent}</Folder>`];
  });
}

/**
 * The labels as a JS array, single-quoted the way the pages here spell it.
 *
 * A label carrying a quote of its own is printed in the other kind, so what
 * comes back is a string the parser reads as one rather than as an escape.
 *
 * @example itemsArray(["bun", "npm"]); // "['bun', 'npm']"
 */
function itemsArray(labels: string[]): string {
  const quoted = labels.map((label) => (label.includes("'") ? `"${label}"` : `'${label}'`));
  return `[${quoted.join(", ")}]`;
}

/** Named attributes in the order given, skipping the ones with no value. */
function jsxAttributes(values: Record<string, string | null>) {
  return Object.entries(values).flatMap(([name, value]) =>
    value === null ? [] : [{ type: "mdxJsxAttribute" as const, name, value }],
  );
}

function listItems(content: JSONContent[] | undefined) {
  return (content ?? []).map((item) => ({
    type: "listItem" as const,
    spread: item.attrs?.spread === true,
    checked: null,
    children: nestedBlocks(item.content),
  }));
}

function nestedBlocks(content: JSONContent[] | undefined) {
  return (content ?? []).map(blockToMdast) as (BlockContent | DefinitionContent)[];
}

function inlineToMdast(content: JSONContent[] | undefined): PhrasingContent[] {
  return groupByMark((content ?? []).map((node) => ({ node, marks: sortMarks(node.marks) })));
}

/**
 * Wraps the outermost shared mark around each run of leaves that carries it,
 * then recurses on what is left. Runs are broken by a differing mark, which is
 * what keeps `[a](x)[b](y)` from collapsing into one link.
 */
function groupByMark(leaves: Leaf[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let i = 0;

  while (i < leaves.length) {
    const leaf = leaves[i];
    if (leaf === undefined) break;

    const [mark] = leaf.marks;
    if (mark === undefined) {
      out.push(leafToMdast(leaf.node));
      i += 1;
      continue;
    }

    let end = i + 1;
    while (end < leaves.length && sameMark(leaves[end]?.marks[0], mark)) end += 1;

    const inner = leaves.slice(i, end).map((leaf) => ({ node: leaf.node, marks: leaf.marks.slice(1) }));
    out.push(markToMdast(mark, inner));
    i = end;
  }

  return out;
}

function markToMdast(mark: Mark, inner: Leaf[]): PhrasingContent {
  if (mark.type === "code") {
    return { type: "inlineCode", value: inner.map((leaf) => leaf.node.text ?? "").join("") };
  }

  if (mark.type === "abbr") {
    const title = stringOrNull(mark.attrs?.title);
    const text = inner.map((leaf) => leaf.node.text ?? "").join("");
    const attr = title !== null ? ` title="${escapeAttr(title)}"` : "";
    return { type: "html", value: `<abbr${attr}>${text}</abbr>` };
  }

  const children = groupByMark(inner);
  switch (mark.type) {
    case "bold":
      return { type: "strong", children };
    case "italic":
      return { type: "emphasis", children };
    case "strike":
      return { type: "delete", children };
    default:
      return {
        type: "link",
        url: stringOrNull(mark.attrs?.href) ?? "",
        title: stringOrNull(mark.attrs?.title),
        children,
      };
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function leafToMdast(node: JSONContent): PhrasingContent {
  switch (node.type) {
    case "text":
      return { type: "text", value: node.text ?? "" };
    case "hardBreak":
      return { type: "break" };
    case "image":
      return imageToMdast(node);
    default:
      throw new Error(`live-edit: no markdown mapping for inline node "${node.type}"`);
  }
}

function imageToMdast(node: JSONContent): PhrasingContent {
  return {
    type: "image",
    url: stringOrNull(node.attrs?.src) ?? "",
    alt: stringOrNull(node.attrs?.alt),
    title: stringOrNull(node.attrs?.title),
  };
}

/**
 * Fixed nesting order, outermost first. Marks outside this list, underline for
 * instance, are dropped: markdown cannot express them, and keeping the text is
 * better than failing the save.
 */
const markOrder = ["link", "bold", "italic", "strike", "abbr", "code"];

function sortMarks(marks: JSONContent["marks"]): Mark[] {
  return (marks ?? [])
    .filter((mark) => markOrder.includes(mark.type))
    .sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type))
    .map((mark) => ({ type: mark.type, attrs: mark.attrs }));
}

function sameMark(a: Mark | undefined, b: Mark) {
  if (a === undefined || a.type !== b.type) return false;
  return JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});
}

function textOf(content: JSONContent[] | undefined) {
  return (content ?? []).map((node) => node.text ?? "").join("");
}

function headingDepth(level: unknown) {
  const depth = numberOr(level, 1);
  return Math.min(Math.max(depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}
