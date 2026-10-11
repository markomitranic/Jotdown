import { cn } from "cn";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import type { InertKind } from "../../types";
import { ATOM, SELECTED } from "./atom";

/**
 * Human name for an inert block, shown as its label.
 *
 * Falls through to "raw source" for anything the bridge could not classify, so
 * an unrecognised construct still reads as deliberate rather than broken.
 */
function labelFor(kind: InertKind) {
  switch (kind) {
    case "esm":
      return "import";
    case "jsx":
      return "component";
    case "expression":
      return "expression";
    case "html":
    case "native":
      return "html";
    default:
      return "raw source";
  }
}

/**
 * True when the block's source is plain HTML/SVG that can be rendered visually.
 *
 * `html` is raw HTML in `.md` files, `native` is a JSX flow element with a
 * lowercase tag (like `<svg>` or `<figure>`) in `.mdx` files. Both are safe to
 * render with `dangerouslySetInnerHTML` because the source is from the repo, not
 * user input.
 */
function isRenderable(kind: InertKind) {
  return kind === "html" || kind === "native";
}

/**
 * JSX attribute names that differ from their HTML/SVG equivalents.
 *
 * MDX files use JSX syntax (`className`, `fontSize`), but `dangerouslySetInnerHTML`
 * feeds the string to the browser's HTML parser, which only understands the
 * standard attribute names.
 */
const JSX_ATTRS: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  fontSize: "font-size",
  fontFamily: "font-family",
  fontWeight: "font-weight",
  fontStyle: "font-style",
  textAnchor: "text-anchor",
  textDecoration: "text-decoration",
  strokeWidth: "stroke-width",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeOpacity: "stroke-opacity",
  fillOpacity: "fill-opacity",
  markerEnd: "marker-end",
  markerStart: "marker-start",
  markerMid: "marker-mid",
  letterSpacing: "letter-spacing",
  clipPath: "clip-path",
  clipRule: "clip-rule",
  fillRule: "fill-rule",
};

const jsxAttrPattern = new RegExp(`\\b(${Object.keys(JSX_ATTRS).join("|")})=`, "g");

/** Rewrites JSX attribute names to their HTML/SVG equivalents. */
function jsxToHtml(source: string): string {
  return source.replace(jsxAttrPattern, (_, attr) => `${JSX_ATTRS[attr]}=`);
}

/**
 * Renders an inert MDX block.
 *
 * Native HTML and SVG blocks render visually so the figures stay visible while
 * editing. Everything else (imports, React components, expressions) shows its
 * source in a muted panel. Both variants are uneditable atoms: click to select,
 * delete to remove, otherwise untouchable.
 *
 * The rendered variant restates the panel width the reading view gives a
 * figure, because the wrapper is what the prose sees as its child and the
 * figure inside it is a grandchild.
 */
export default function MdxBlockView({ node, selected }: ReactNodeViewProps) {
  const { source, kind } = node.attrs;

  if (isRenderable(kind)) {
    return (
      <NodeViewWrapper
        as="div"
        className={cn(ATOM, "mx-auto my-8 [&_.jd-fig]:m-0", selected && SELECTED)}
        contentEditable={false}
      >
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: draws the page's own figure markup, as the published page does */}
        <div dangerouslySetInnerHTML={{ __html: jsxToHtml(source) }} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className={cn(ATOM, "my-6 border-border border-dashed bg-secondary/40 px-4 py-3", selected && SELECTED)}
      contentEditable={false}
    >
      <span className="mb-2 block font-label font-medium text-[0.64rem] text-muted-foreground uppercase tracking-[0.11em]">
        {labelFor(kind)}
      </span>
      <pre className="m-0 overflow-x-auto bg-transparent p-0 font-mono text-[0.79rem] text-muted-foreground leading-relaxed">
        {source}
      </pre>
    </NodeViewWrapper>
  );
}
