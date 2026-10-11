import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { CodeBlock, Pre } from "@jotdown/core/components/blocks/CodeBlock";
import { inFrameAt } from "./inFrame";

/**
 * The languages offered, and what each is called where a reader can see it.
 *
 * Shiki bundles several hundred, which is a scroll rather than a choice. These
 * are the ones written under `docs/` plus the few a technical page reaches for
 * next, and the empty value is a fence with no language at all, which is what
 * the file spells as a bare ``` and what the build leaves unhighlighted.
 *
 * A language the file already carries but this list does not know is added to
 * the picker as itself, so opening such a fence cannot silently retype it.
 */
const LANGUAGES: Array<[value: string, label: string]> = [
  ["", "Plain text"],
  ["bash", "Bash"],
  ["css", "CSS"],
  ["diff", "Diff"],
  ["dockerfile", "Dockerfile"],
  ["html", "HTML"],
  ["js", "JavaScript"],
  ["json", "JSON"],
  ["jsx", "JSX"],
  ["md", "Markdown"],
  ["mdx", "MDX"],
  ["python", "Python"],
  ["sh", "Shell"],
  ["sql", "SQL"],
  ["toml", "TOML"],
  ["ts", "TypeScript"],
  ["tsx", "TSX"],
  ["yaml", "YAML"],
];

/**
 * The filename a fence's meta string names, which the built page prints as its header.
 *
 * @example titleIn('title="lib/source.ts" lineNumbers'); // "lib/source.ts"
 * @example titleIn(null); // null
 */
function titleIn(meta: unknown): string | null {
  if (typeof meta !== "string") return null;
  return /title="([^"]*)"/.exec(meta)?.[1] ?? null;
}

/**
 * A built fence never wraps: a long line runs past the frame and the frame scrolls.
 *
 * Tiptap's content element wraps its text with an inline style of its own, so a
 * long line was two lines while being written and one when read. Written here
 * because an inline style is the only thing that beats an inline style.
 */
const NO_WRAP = { whiteSpace: "pre" } as const;

/** Form controls do not inherit the caption's type, and would otherwise render in the OS font. */
const INHERIT = { font: "inherit", letterSpacing: "inherit" } as const;

/**
 * A code fence you are writing in, looking exactly like a fence being read.
 *
 * The build draws a fence as the core's `CodeBlock`: a frame, a header only
 * when the fence has a title, a copy button, a scrolling `<pre>`. A fence from
 * the file keeps that very frame and this view is mounted inside it, drawing
 * only the `<pre>`, so nothing on the page moves when the editor arrives. A
 * fence inserted from the menu has no frame yet, so the view draws the same
 * `CodeBlock` around itself, with the same rule for the header. Which of the
 * two is the editor's `InFrame` flag.
 *
 * ProseMirror's own `<pre><code>` would not survive the article's typography,
 * which paints `:where(code)` as an inline pill; the frame's `not-prose` is what
 * turns that off, and `Pre` is the same element the build writes.
 *
 * The language is the one thing about a fence that cannot be typed, and it
 * decides how the built page colours the block. It is a small control in the
 * frame's corner, beside the copy button, shown while the pointer is over the
 * fence or a caret is in it, so a page being read looks like the built one.
 *
 * @example addNodeView: () => ReactNodeViewRenderer(CodeBlockView)
 */
export default function CodeBlockView({ editor, node, getPos, updateAttributes }: ReactNodeViewProps) {
  const language = typeof node.attrs.language === "string" ? node.attrs.language : "";
  const known = LANGUAGES.some(([value]) => value === language);
  const options = known ? LANGUAGES : [...LANGUAGES, [language, language] as const];
  const title = titleIn(node.attrs.meta);
  const lineNumbers = node.textContent
    .split("\n")
    .map((_, index) => index + 1)
    .join("\n");

  const picker = (
    <select
      className="jd-fence-language cursor-pointer appearance-none rounded-md border-0 bg-card px-1.5 py-0.5 text-muted-foreground text-xs hover:text-foreground hover:underline hover:decoration-dotted"
      style={INHERIT}
      value={language}
      aria-label="Code language"
      contentEditable={false}
      onChange={(event) => updateAttributes({ language: event.target.value || null })}
    >
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  const written = (
    <div className="jd-fence-content">
      <span className="jd-fence-lines" style={NO_WRAP} aria-hidden="true" contentEditable={false}>
        {lineNumbers}
      </span>
      <Pre>
        <NodeViewContent<"code"> as="code" style={NO_WRAP} />
      </Pre>
    </div>
  );

  if (inFrameAt(editor, getPos())) {
    return (
      <NodeViewWrapper>
        {written}
        {picker}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <CodeBlock title={title ?? undefined} data-line-numbers>
        {written}
        {picker}
      </CodeBlock>
    </NodeViewWrapper>
  );
}
