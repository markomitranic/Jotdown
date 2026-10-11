/**
 * Where in the file a block was written, as the browser reads it back.
 *
 * The stamp itself is written at compile time by `remark-source-range.ts`. This
 * half is the reading half, and it imports nothing, because every editable
 * block in the browser needs it and the compiling half pulls in Shiki.
 *
 * Positions are lines and columns rather than byte offsets on purpose.
 * Fumadocs compiles a page with its front matter replaced by as many blank
 * lines as it occupied (`"\n".repeat(...) + content`), which keeps every line
 * number the author's and shifts every offset by the length of the front
 * matter. Lines are the part upstream is deliberately preserving, so lines are
 * what we carry.
 */

/** The prop a stamped block arrives with, as `startLine:startColumn-endLine:endColumn`. */
export const SOURCE_RANGE = "data-src-range";

/**
 * Marks a stamped block whose own component already answers for it.
 *
 * Most of the article is blocks no component of ours is registered for: a
 * table, a fence, a `<Steps>`. Those are found by sweeping the page for stamps
 * once it has mounted, and the sweep has to know which stamps are already
 * spoken for. A component that will answer for its own block writes this the
 * moment it mounts, before it knows whether it can edit the block or not,
 * which is what keeps the sweep from racing the editor chunk it loads.
 */
export const CLAIMED = "data-inplace";

/**
 * The mark itself, ready to spread onto a stamped element in JSX.
 *
 * @example <figure data-src-range={stamp} {...answeredFor(stamp)} />
 */
export function answeredFor(stamp: string | undefined) {
  return stamp === undefined ? null : { [CLAIMED]: "1" };
}

/** Half-open offsets into the file a stamp was cut from. */
export type SourceRange = { start: number; end: number };

/**
 * Turns a stamp back into offsets into the file text the reader's page was built from.
 *
 * The text must be the whole file, front matter included, which is what
 * `page.data.getText("raw")` serves and what a save splices into.
 *
 * @example rangeIn("---\nt: x\n---\n\n# Hi\n", "5:1-5:5"); // { start: 14, end: 18 }
 */
export function rangeIn(source: string, stamp: string): SourceRange | null {
  const parsed = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(stamp);
  if (!parsed) return null;

  const [, startLine = 0, startColumn = 0, endLine = 0, endColumn = 0] = parsed.map(Number);
  const lines = lineStarts(source);

  const at = (line: number, column: number) => {
    const base = lines[line - 1];
    return base === undefined ? null : Math.min(base + column - 1, source.length);
  };

  const start = at(startLine, startColumn);
  const end = at(endLine, endColumn);

  return start === null || end === null || end < start ? null : { start, end };
}

/** The offset each 1-based line begins at, indexed from zero. */
function lineStarts(source: string): number[] {
  const starts = [0];
  for (let at = 0; at < source.length; at++) if (source[at] === "\n") starts.push(at + 1);
  return starts;
}

/**
 * The stamp naming a stretch of the file between two offsets, the reverse of `rangeIn`.
 *
 * @example stampAt("# Hi\n\nOld.\n", 6, 10); // "3:1-3:5"
 */
export function stampAt(source: string, start: number, end: number) {
  const point = (offset: number) => {
    const before = source.slice(0, offset);
    const line = before.split("\n").length;
    return `${line}:${offset - before.lastIndexOf("\n")}`;
  };
  return `${point(start)}-${point(end)}`;
}
