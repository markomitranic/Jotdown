/**
 * Stamping every top-level block with the slice of the file it was written as.
 *
 * A block that edits itself has to know which bytes to replace, and the only
 * place that knowledge exists is the parse. This stamps it onto the tree at
 * compile time, so it arrives in the browser as a prop on the rendered element
 * and no second parse is needed to find a block again.
 *
 * Positions are lines and columns rather than byte offsets on purpose.
 * Fumadocs compiles a page with its front matter replaced by as many blank
 * lines as it occupied (`"\n".repeat(...) + content`), which keeps every line
 * number the author's and shifts every offset by the length of the front
 * matter. Lines are the part upstream is deliberately preserving, so lines are
 * what we carry.
 */

import type { Root, RootContent } from "mdast";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import type { Element, Root as HastRoot } from "hast";
import { CODE_THEME } from "@jotdown/core/lib/code-theme";
import { SOURCE_RANGE } from "./source-range";

/** Node types that render to no element, so there is nothing to hang a prop on. */
const UNSTAMPABLE = new Set(["mdxFlowExpression", "mdxjsEsm", "yaml", "definition"]);

type JsxAttribute = { type: "mdxJsxAttribute"; name: string; value: string };

type Stampable = RootContent & {
  data?: { hProperties?: Record<string, unknown> };
  attributes?: JsxAttribute[];
};

/**
 * Writes each top-level block's source range onto the tree as `data-src-range`.
 *
 * Runs last of our own plugins, so it sees the shapes the earlier ones produce:
 * a `:::note` is already `<CalloutContainer>` and a mermaid fence is already
 * `<Mermaid>`, and both carry the position of the source they were rewritten
 * from. Markdown blocks take the stamp through `hProperties`, JSX elements
 * through their own attributes.
 *
 * A code fence is the one shape this cannot finish on its own: it becomes
 * `<pre><code>`, `hProperties` land on the inner element, and the Shiki pass
 * later throws that element away. `sourceRangeCodeOptions` below carries it
 * across, so by the time a component sees a fence the stamp is on the `<pre>`.
 *
 * The blocks named in `inside` have their children stamped as well, so the
 * prose between a project block's tags is edited in place like the page's own,
 * however deep that block stands among other project blocks.
 *
 * @example [remarkSourceRange, { inside: ["Hero"] }]
 */
export function remarkSourceRange({ inside = [] }: { inside?: string[] } = {}) {
  const opened = new Set(inside);

  const stampAll = (nodes: Stampable[]) => {
    for (const node of nodes) {
      stamp(node);
      if (node.type === "mdxJsxFlowElement" && opened.has(node.name ?? "")) stampAll(node.children as Stampable[]);
    }
  };

  return (tree: Root) => stampAll(tree.children as Stampable[]);
}

/** Writes one block's range onto it, as an attribute for a JSX element and a property for the rest. */
function stamp(node: Stampable) {
  if (UNSTAMPABLE.has(node.type)) return;

  const { start, end } = node.position ?? {};
  if (!start || !end) return;

  const range = `${start.line}:${start.column}-${end.line}:${end.column}`;

  if (node.type === "mdxJsxFlowElement") {
    node.attributes = [...(node.attributes ?? []), { type: "mdxJsxAttribute", name: SOURCE_RANGE, value: range }];
    return;
  }

  node.data = { ...node.data, hProperties: { ...node.data?.hProperties, [SOURCE_RANGE]: range } };
}

/**
 * Carries a code fence's stamp across the Shiki rehype pass, which rebuilds the `<pre>`.
 *
 * Everything else keeps the prop the remark plugin wrote, because nothing else
 * replaces its node. A fence does: Shiki highlights the code and hands back a
 * fresh element, so the only attributes that survive are the ones Fumadocs
 * lifts out of the fence's meta string. That lift runs while the original
 * `<code>` is still in the tree, which is where the stamp is read from here.
 *
 * Pass it as `rehypeCodeOptions`. Fumadocs merges it over its own defaults, so
 * the highlighter, themes and notation transformers are untouched.
 */
export const sourceRangeCodeOptions = {
  ...rehypeCodeDefaultOptions,
  themes: CODE_THEME,

  parseMetaString(meta: string, node: Element, tree: HastRoot) {
    const parsed = rehypeCodeDefaultOptions.parseMetaString?.(meta, node, tree) ?? {};

    const code = node.children.find((child): child is Element => child.type === "element" && child.tagName === "code");
    const stamp = code?.properties?.[SOURCE_RANGE];

    return stamp ? { ...parsed, [SOURCE_RANGE]: stamp } : parsed;
  },
};
