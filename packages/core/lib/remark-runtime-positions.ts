import { readFileSync } from "node:fs";
import type { Root } from "mdast";
import type { Node } from "unist";
import type { VFile } from "vfile";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";

/** Restores original line numbers after the runtime compiler removes front matter. */
export function remarkRuntimePositions() {
  return (tree: Root, file: VFile) => {
    const { matter, content } = frontmatter(readFileSync(file.path, "utf8"));
    if (String(file.value) !== content) return;
    const lines = matter.split("\n").length - 1;
    shift(tree, lines);
  };
}

/** Adds the removed front-matter lines to each positioned Markdown node. */
function shift(node: Node & { children?: Node[] }, lines: number) {
  if (node.position) {
    node.position.start.line += lines;
    node.position.end.line += lines;
  }
  node.children?.forEach((child) => shift(child, lines));
}
