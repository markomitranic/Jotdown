/**
 * File text to an editable document.
 *
 * Alongside the ProseMirror tree this records, per top-level block, where it sat
 * in the original file and how it prints. Saving compares against that record
 * and splices untouched regions straight out of `source`, which is what keeps a
 * one-paragraph edit to a one-paragraph diff.
 */

import type { JSONContent } from "@tiptap/core";
import type { Root } from "mdast";
import type { BlockOrigin, ParsedDoc } from "../types";
import { readFrontmatterField } from "./frontmatter";
import { printBlock } from "./fromProseMirror";
import { nodeRange, parseMarkdown } from "./pipeline";
import { blockToProseMirror, inertBlock } from "./toProseMirror";

export function parseDocument(source: string): ParsedDoc {
  const tree = parseMarkdown(source);
  const frontmatter = readFrontmatter(tree, source);
  const blocks = frontmatter === null ? tree.children : tree.children.slice(1);

  const content: JSONContent[] = [];
  const pristine = new Map<number, string>();

  blocks.forEach((block, srcIndex) => {
    const mapped = blockToProseMirror(block, source) ?? inertBlock(block, source);
    const node = withOrigin(mapped, { srcIndex, ...nodeRange(block) });
    pristine.set(srcIndex, printBlock(node));
    content.push(node);
  });

  return {
    source,
    frontmatter,
    title: field(frontmatter, "title"),
    icon: field(frontmatter, "icon"),
    description: field(frontmatter, "description"),
    doc: { type: "doc", content },
    pristine,
  };
}

/**
 * The frontmatter verbatim, fences included.
 *
 * Taken by offset rather than from the parsed node's `value`, because the editor
 * writes the block back with only one line changed and needs the original bytes
 * of every other line.
 */
function readFrontmatter(tree: Root, source: string): string | null {
  const [first] = tree.children;
  if (first?.type !== "yaml") return null;
  const { srcStart, srcEnd } = nodeRange(first);
  return source.slice(srcStart, srcEnd);
}

function field(frontmatter: string | null, key: string) {
  return frontmatter === null ? null : readFrontmatterField(frontmatter, key);
}

function withOrigin(node: JSONContent, origin: BlockOrigin): JSONContent {
  return { ...node, attrs: { ...node.attrs, ...origin } };
}
