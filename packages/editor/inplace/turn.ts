/**
 * "Turn into": one block rewritten as another kind, carrying its words across.
 *
 * Every kind here is either a run of words (text, a heading), a run of items
 * (both lists), a box of blocks (a quote, a callout) or a fence. Turning within
 * one family swaps the wrapper and keeps everything inside it. Turning across
 * families reads the block as lines of words and builds the new kind from them,
 * which is why a list of three items turned into text is three paragraphs.
 */

import type { JSONContent } from "@tiptap/core";

export type TurnKind =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "heading4"
  | "bulletList"
  | "orderedList"
  | "codeBlock"
  | "blockquote"
  | "callout";

/** Every kind a block can turn into, in the order the menu lists them. */
export const TURN_KINDS: Array<{ kind: TurnKind; title: string }> = [
  { kind: "paragraph", title: "Text" },
  { kind: "heading2", title: "Heading 2" },
  { kind: "heading3", title: "Heading 3" },
  { kind: "heading4", title: "Heading 4" },
  { kind: "bulletList", title: "Bulleted list" },
  { kind: "orderedList", title: "Numbered list" },
  { kind: "codeBlock", title: "Code" },
  { kind: "blockquote", title: "Quote" },
  { kind: "callout", title: "Callout" },
];

type Line = JSONContent[];

/** Whether a block is a link drawn as a card or a video, which turns back into the link. */
export function isEmbed(block: JSONContent): boolean {
  return block.type === "linkEmbed" || block.type === "videoEmbed";
}

/**
 * Names the kind a block is, or null for one that turns into nothing.
 *
 * @example kindOf({ type: "heading", attrs: { level: 3 } }); // "heading3"
 * @example kindOf({ type: "table" }); // null
 */
export function kindOf(block: JSONContent): TurnKind | null {
  switch (block.type) {
    case "paragraph":
    case "bulletList":
    case "orderedList":
    case "blockquote":
      return block.type;

    case "heading":
      return headingKind(block.attrs?.level);

    case "codeBlock":
      return block.attrs?.language === "mermaid" ? null : "codeBlock";

    case "admonition":
      return "callout";

    default:
      return null;
  }
}

/**
 * Rewrites one block as another kind, as the blocks that now stand in its place.
 *
 * @example turnInto({ type: "paragraph", content: [text] }, "heading2"); // [{ type: "heading", … }]
 * @example turnInto(listOfThree, "paragraph").length; // 3
 */
export function turnInto(block: JSONContent, kind: TurnKind): JSONContent[] {
  const from = kindOf(block);
  if (from === kind) return [block];

  if (isList(kind) && from !== null && isList(from)) return [{ ...block, type: kind }];
  if (isBox(kind) && from !== null && isBox(from)) return [boxOf(kind, block.content ?? [])];

  const lines = linesOf(block);

  switch (kind) {
    case "paragraph":
      return lines.map((line) => ({ type: "paragraph", content: line }));

    case "heading2":
    case "heading3":
    case "heading4":
      return lines.map((line) => ({ type: "heading", attrs: { level: Number(kind.at(-1)) }, content: line }));

    case "bulletList":
    case "orderedList":
      return [{ type: kind, content: lines.map(itemOf) }];

    case "blockquote":
    case "callout":
      return [
        boxOf(
          kind,
          lines.map((line) => ({ type: "paragraph", content: line })),
        ),
      ];

    case "codeBlock":
      return [fenceOf(lines)];
  }
}

/**
 * Reads a block as lines of words: one per paragraph, heading, item or fence line.
 *
 * An embed is one line holding its link, so a card or a video turns back into
 * the link it was pasted as. Always at least one line, so an empty block turns
 * into an empty block rather than nothing.
 */
function linesOf(block: JSONContent): Line[] {
  if (isEmbed(block)) {
    const url = String(block.attrs?.url ?? "");
    return [url === "" ? [] : [{ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }]];
  }

  if (block.type === "codeBlock") {
    const source = (block.content ?? []).map((node) => node.text ?? "").join("");
    return source.split("\n").map((text) => (text === "" ? [] : [{ type: "text", text }]));
  }

  const lines: Line[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "codeBlock") lines.push(...linesOf(node));
    else if (isTextblock(node)) lines.push(node.content ?? []);
    else node.content?.forEach(walk);
  };

  if (isTextblock(block)) lines.push(block.content ?? []);
  else block.content?.forEach(walk);

  return lines.length === 0 ? [[]] : lines;
}

function fenceOf(lines: Line[]): JSONContent {
  const text = lines.map(plainText).join("\n");

  return {
    type: "codeBlock",
    attrs: { language: null },
    content: text === "" ? [] : [{ type: "text", text }],
  };
}

function plainText(line: Line): string {
  return line.map((node) => (node.type === "hardBreak" ? "\n" : (node.text ?? ""))).join("");
}

function itemOf(line: Line): JSONContent {
  return { type: "listItem", content: [{ type: "paragraph", content: line }] };
}

function boxOf(kind: "blockquote" | "callout", content: JSONContent[]): JSONContent {
  if (kind === "blockquote") return { type: "blockquote", content };

  return { type: "admonition", attrs: { kind: "note", title: null }, content };
}

function headingKind(level: unknown): TurnKind | null {
  if (level === 2) return "heading2";
  if (level === 3) return "heading3";
  if (level === 4) return "heading4";
  return null;
}

function isTextblock(node: JSONContent): boolean {
  return node.type === "paragraph" || node.type === "heading";
}

function isList(kind: TurnKind): kind is "bulletList" | "orderedList" {
  return kind === "bulletList" || kind === "orderedList";
}

function isBox(kind: TurnKind): kind is "blockquote" | "callout" {
  return kind === "blockquote" || kind === "callout";
}
