import remarkDirective from "remark-directive";
import type { Root } from "mdast";
import type { PluggableList } from "unified";
import { remarkDirectiveAdmonition } from "fumadocs-core/mdx-plugins";
import { BARE_PAGE_LINK } from "@jotdown/core/lib/links";
import { remarkChangelog } from "./changelog";
import { remarkMermaid } from "./remark-mermaid";
import { isWidth, remarkBlockWidth } from "./block-width";

/**
 * The framework's own remark plugins, in the order a page runs through them.
 *
 * The build runs these through `fumadocs-mdx`, ahead of its default plugins,
 * and a canvas runs the same list in the browser, so a page draws the same in
 * both. Each one is described where it is defined.
 */

/**
 * Every Docusaurus admonition keyword, plus our own `:::source`, mapped onto the
 * type `components/blocks/Callout.tsx` draws.
 *
 * Passing `types` clears the plugin's defaults, so every keyword we accept is
 * listed here, aliases included: a directive name missing from this map is put
 * back as the text the author typed, by `remarkLiteralDirectives` below. The
 * values are our own keywords rather than the six of `fumadocs-core`, because the Callout
 * wrapper is what decides how each one looks and `:::source` has no upstream
 * counterpart at all.
 */
const admonitions = {
  note: "note",
  tip: "tip",
  info: "info",
  warning: "warning",
  warn: "warning",
  caution: "warning",
  danger: "danger",
  source: "source",
};

type Branch = {
  type: string;
  value?: string;
  url?: string;
  children?: Branch[];
  position?: Root["position"];
};

const DIRECTIVE_TYPES = new Set(["textDirective", "leafDirective", "containerDirective"]);

/**
 * Puts every directive the admonition map did not claim back as the text the author typed.
 *
 * `remark-directive` reads a colon followed by a word as a directive, so an
 * ordinary time in prose (`11:04:07`) parses as one and renders as an empty
 * `<div>`. Inside an inline SVG figure that div is what breaks the page: the
 * browser moves HTML out of foreign content, so the tree React hydrates is not
 * the tree it sent, and the whole document is thrown away and drawn again on
 * the client. A `:::note` is an `mdxJsxFlowElement` by the time this runs, and
 * a `:::wide` or `:::full` is left for the width plugin further down the chain,
 * so anything else still typed as a directive is a false positive.
 */
function remarkLiteralDirectives() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);

    const literal = (node: Branch): Branch => {
      const from = node.position?.start.offset;
      const to = node.position?.end.offset;
      if (from === undefined || to === undefined) return node;

      const typed = { type: "text", value: source.slice(from, to) };
      return node.type === "textDirective" ? typed : { type: "paragraph", children: [typed] };
    };

    const walk = (node: Branch) => {
      if (!node.children) return;

      node.children = node.children
        .map((child) => (DIRECTIVE_TYPES.has(child.type) && !isWidth(child) ? literal(child) : child))
        .reduce(joinText, []);

      node.children.forEach(walk);
    };

    walk(tree as Branch);
  };
}

/**
 * A link to a file in the same folder, spelt the way Fumadocs resolves links.
 *
 * `source.resolveHref` only looks a link up in the page tree when it starts
 * with `./` or `../`. Anything else is handed to the browser as typed, so
 * `[Form](Form.md)` renders as an href the site has no page at and 404s on the
 * click, with nothing said at build time.
 *
 * TypeDoc writes exactly that spelling for every page it generates, which is
 * enough to make a whole reference section unclickable. Writing in the `./` a
 * human would have typed is the entire fix, and it is done here rather than in
 * the generated files so the next generation does not undo it.
 */
function remarkBarePageLinks() {
  return (tree: Root) => {
    const walk = (node: Branch) => {
      if (node.type === "link" && node.url && BARE_PAGE_LINK.test(node.url)) {
        node.url = `./${node.url}`;
      }

      node.children?.forEach(walk);
    };

    walk(tree as Branch);
  };
}

/** True when a figure holds an `<svg>` somewhere inside it, which is the thing the stage can open. */
function holdsDrawing(node: Branch & { name?: string }): boolean {
  return node.name === "svg" || (node.children?.some(holdsDrawing) ?? false);
}

/**
 * Turns a `<figure className="jd-fig">` that holds a drawing into `<JdFigure>`, the component behind the stage.
 *
 * MDX hands a lowercase JSX tag to the browser as that tag; the `components`
 * map only reaches elements markdown produced. So a hand-drawn figure is
 * renamed here, at build time, the way `remarkMermaid` turns a fence into
 * `<Mermaid>`, and `components/blocks/JdFigure.tsx` marks it as a figure the
 * fullscreen stage opens. The author still writes `<figure>`; the file on
 * disk and the editor's round trip never see the rename.
 *
 * An HTML figure, the skill's escape hatch for a comparison table or real text
 * wrapping, has no SVG for the stage to show, so it keeps its own tag and is
 * left with no cursor, hover border or Click to expand to promise otherwise.
 */
function remarkJdFigure() {
  return (tree: Root) => {
    const walk = (node: Branch & { name?: string; attributes?: { name?: string; value?: unknown }[] }) => {
      if (node.type === "mdxJsxFlowElement" && node.name === "figure") {
        const className = node.attributes?.find((a) => a.name === "className")?.value;
        const isFigure = typeof className === "string" && className.split(/\s+/).includes("jd-fig");
        if (isFigure && holdsDrawing(node)) {
          node.name = "JdFigure";
        }
      }
      node.children?.forEach(walk);
    };

    walk(tree as Branch);
  };
}

/**
 * Joins a run of text nodes into one, so a rescued directive reads as one string.
 *
 * React writes a `<!-- -->` between two adjacent text children to tell them
 * apart on hydration, and inside an SVG `<text>` that comment is markup nobody
 * wrote sitting in the middle of a label.
 *
 * @example [{ value: "09" }, { value: ":12Z" }] // one node, "09:12Z"
 */
function joinText(nodes: Branch[], node: Branch) {
  const last = nodes.at(-1);
  if (last?.type !== "text" || node.type !== "text") return [...nodes, node];

  last.value = (last.value ?? "") + (node.value ?? "");
  return nodes;
}

/**
 * Every plugin of ours that rewrites a page, first to last.
 *
 * `remarkSourceRange` comes after these and after anything that restores line
 * numbers, so the ranges it stamps are the ones every rewrite left behind.
 *
 * @example compile(text, { remarkPlugins: [...remarkChain, remarkSourceRange, ...defaults] });
 */
export const remarkChain: PluggableList = [
  remarkDirective,
  [remarkDirectiveAdmonition, { types: admonitions }],
  remarkLiteralDirectives,
  remarkBarePageLinks,
  remarkJdFigure,
  remarkChangelog,
  remarkMermaid,
  remarkBlockWidth,
];
