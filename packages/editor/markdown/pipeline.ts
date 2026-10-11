/**
 * The one parser and the one set of serialisation settings this bridge uses.
 *
 * Both directions must agree exactly. Parsing decides which mdast node types
 * appear, serialising decides how a changed block is printed, and pristine
 * detection compares one against the other. Any divergence between the two
 * shows up as a spurious diff, so they live in a single file.
 */

import type { Nodes, Root, RootContent } from "mdast";
import { directiveToMarkdown } from "mdast-util-directive";
import { frontmatterToMarkdown } from "mdast-util-frontmatter";
import { gfmToMarkdown } from "mdast-util-gfm";
import { mdxToMarkdown } from "mdast-util-mdx";
import { toMarkdown, type Handle, type Options } from "mdast-util-to-markdown";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkMdx)
  .freeze();

const directive = directiveToMarkdown();
const printContainerDirective = directive.handlers?.containerDirective;
if (!printContainerDirective) throw new Error("mdast-util-directive no longer prints container directives");

/**
 * Prints `:::note` with a blank line inside each fence.
 *
 * `mdast-util-directive` writes the opening fence tight against the first block,
 * while every admonition committed under `docs` has blank lines inside its
 * fences. Matching the files means editing a paragraph inside an admonition does
 * not also move the fences around it.
 */
const paddedContainerDirective: Handle = (node, parent, state, info) => {
  const printed = printContainerDirective(node, parent, state, info);
  const lines = printed.split("\n");
  if (lines.length < 3) return printed;
  return [lines[0], "", ...lines.slice(1, -1), "", lines[lines.length - 1]].join("\n");
};

/**
 * Settings chosen to match the markdown already committed under `docs`.
 *
 * `toMarkdown` has no line-wrapping option, so prose is never reflowed. The
 * markers below are the rest of what it would otherwise normalise. Changing any
 * of them makes the next save of every edited block produce a noisy diff.
 */
const markdownOptions: Options = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  rule: "-",
  listItemIndent: "one",
  incrementListMarker: true,
  extensions: [
    // Table pipes are not padded to a common column width. Padding reads better
    // in the raw file, but it means widening one cell rewrites every other row,
    // and the role table under `docs/architecture` has rows past 300 characters
    // that every short row would then be padded out to.
    gfmToMarkdown({ tablePipeAlign: false }),
    frontmatterToMarkdown(["yaml"]),
    directive,
    mdxToMarkdown(),
    { handlers: { containerDirective: paddedContainerDirective } },
  ],
};

/** Parses file text into mdast, with positions on every node. */
export function parseMarkdown(source: string): Root {
  return processor.parse(source);
}

/**
 * Prints one mdast node, without the trailing newline `toMarkdown` adds.
 *
 * Callers join blocks with a blank line themselves, and pristine comparison
 * needs a form that is stable whether the block came first, last or in the
 * middle of the file.
 */
export function mdastToMarkdown(node: Nodes): string {
  const printed = toMarkdown(node, markdownOptions).replace(/\n+$/, "");
  return node.type === "table" ? widenDelimiters(printed) : printed;
}

/**
 * Rewrites a table's dashed row from `| - |` to `| --- |`.
 *
 * Turning pipe alignment off also shortens the delimiters to the fewest legal
 * characters, and every table committed under `docs` spells them with three
 * dashes. Matching that means editing a cell does not also move the line under
 * the header. The second line of a printed table is always that row, and it
 * holds nothing but pipes, colons, dashes and spaces.
 */
function widenDelimiters(printed: string): string {
  const lines = printed.split("\n");
  const delimiter = lines[1];
  if (delimiter === undefined) return printed;
  lines[1] = delimiter.replace(/-+/g, "---");
  return lines.join("\n");
}

/**
 * The half-open source range a parsed node occupies.
 *
 * Offsets are only optional in the mdast types because a tree can be built by
 * hand. Everything here comes from parsing a string, where they are always set.
 */
export function nodeRange(node: RootContent) {
  const srcStart = node.position?.start.offset;
  const srcEnd = node.position?.end.offset;
  if (srcStart === undefined || srcEnd === undefined) throw new Error(`A ${node.type} node has no source position`);
  return { srcStart, srcEnd };
}
