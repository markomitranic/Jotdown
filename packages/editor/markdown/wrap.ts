/**
 * Putting a block's lines back at the column the author wrapped them to.
 *
 * Markdown treats a single newline inside a paragraph as a space, so a
 * paragraph hard-wrapped over eight lines and a paragraph written as one long
 * line are the same document. The parse keeps the document and loses the
 * wrapping, and the printer writes the space, which is why editing one word of
 * a wrapped paragraph used to come back as one line several hundred characters
 * long: correct, unreadable, and a diff nobody can review.
 *
 * Nearly every page under `docs/` is hard-wrapped at about eighty, so for them
 * this is the difference between a one-line diff and a whole-paragraph one. For
 * the few that are not, the answer is to leave them alone, which is why the
 * column is measured rather than assumed. It is a fill rather than a
 * restoration: the words go back at the column the author used, the way
 * pressing `gq` in an editor would, and a paragraph somebody has actually
 * changed reflows from the change onwards rather than from its first word.
 *
 * Nothing here parses markdown. It cannot: what it is handed is already the
 * printer's own output, and re-parsing it to re-print it would be the printer
 * twice. So it works line by line and refuses to touch anything whose bytes
 * mean something at a particular column.
 */

import type { JSONContent } from "@tiptap/core";

/**
 * A line whose meaning depends on where it starts, and which is therefore left alone.
 *
 * A table row, a tag, a link definition, a heading and a directive fence each
 * say what they say by being one line. Filling any of them turns the second
 * half into a paragraph standing where it does not belong.
 */
const VERBATIM = /^\s*(?:[|<#]|:::|\[[^\]]+\]:)/;

/** A fence, which turns wrapping off until the matching one turns it back on. */
const FENCE = /^\s*(?:```|~~~)/;

/** What a line may begin with and still be the line it was: a list marker, or a quote. */
const MARKER = /^(?:[-*+] |\d+[.)] |> )/;

/**
 * What a run of text would become if a line began with it.
 *
 * Breaking a line in front of any of these turns prose into a list, a heading,
 * a fence or a rule, because every one of them may interrupt a paragraph. It is
 * the one way a fill can change what a document says rather than only how it
 * reads.
 */
const OPENS = /^(?:[-*+>]\s|#{1,6}\s|\d+[.)]\s|```|~~~|:::|---|===|<)/;

/**
 * The column this file's author wraps at, or null for a file nobody wraps.
 *
 * Measured rather than assumed, because an instance that writes one sentence
 * per line is as valid as one wrapped at eighty and re-flowing the first would
 * be exactly the damage this exists to prevent. What is counted is only the
 * lines that are continued by another, since those are the ones a wrap
 * produced; nine in ten of them fitting inside a hundred columns is what tells
 * you somebody is wrapping on purpose.
 *
 * @example wrapAt(fileWrappedAtEighty); // 80
 * @example wrapAt("One very long line.\n"); // null
 */
export function wrapAt(source: string): number | null {
  const lines = source.split("\n");
  const widths: number[] = [];
  let fenced = false;

  for (const [at, line] of lines.entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }

    const next = lines[at + 1] ?? "";
    if (fenced || !flows(line) || !flows(next)) continue;

    widths.push(line.length);
  }

  if (widths.length < 8) return null;

  widths.sort((a, b) => a - b);
  const column = widths[Math.floor(widths.length * 0.9)];

  return column !== undefined && column <= 100 ? column : null;
}

/** Whether a line is prose a wrap could have produced, rather than a table row or a tag. */
function flows(line: string) {
  return line.trim() !== "" && !VERBATIM.test(line) && !FENCE.test(line);
}

/**
 * Whether a block is prose all the way down, and so may be filled at all.
 *
 * Two questions, because a block can be prose and still be carrying something
 * that is not. Its own type has to be one that wraps: everything else is a
 * block whose bytes mean something at a particular column — a fence, a table, a
 * heading — or one the bridge kept inert and prints back verbatim. And nothing
 * *inside* it may be inert either, because a callout can hold a `<Steps>` that
 * was dragged into it, and a fill would refill the prose lines of that block's
 * own source, which is exactly what "handed back untouched" rules out.
 *
 * @example fillable({ type: "paragraph" }); // true
 * @example fillable({ type: "codeBlock" }); // false
 */
export function fillable(block: JSONContent): boolean {
  return block.type !== undefined && PROSE.has(block.type) && !verbatim(block.content ?? []);
}

const PROSE = new Set(["paragraph", "blockquote", "admonition", "bulletList", "orderedList"]);

/** Whether anything nested in here prints its own bytes back rather than being printed. */
function verbatim(content: readonly JSONContent[]): boolean {
  return content.some((node) => node.type === "mdxBlock" || verbatim(node.content ?? []));
}

/**
 * Fills a block's printed markdown back to a column.
 *
 * @example rewrap("one two three", 7); // "one two\nthree"
 */
export function rewrap(text: string, column: number): string {
  const filled: string[] = [];
  let fenced = false;

  for (const line of text.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      filled.push(line);
      continue;
    }

    if (fenced || line.length <= column || VERBATIM.test(line)) filled.push(line);
    else filled.push(...fill(line, column));
  }

  return filled.join("\n");
}

/**
 * One long line as several, each carrying whatever prefix its first one earned.
 *
 * A list item's continuation lines are indented to where its text began, and a
 * quote's carry the quote back, or the second line would leave the list or the
 * quote it belongs to.
 */
function fill(line: string, column: number): string[] {
  const indent = /^\s*/.exec(line)?.[0] ?? "";
  const markers = leading(line.slice(indent.length));
  const marker = markers.join("");
  const hanging = indent + markers.map((one) => (one.startsWith(">") ? one : " ".repeat(one.length))).join("");
  const body = line.slice(indent.length + marker.length);

  const stops = breaks(body);
  const lines: string[] = [];

  let prefix = indent + marker;
  let at = 0;

  while (prefix.length + body.length - at > column) {
    const cut = nextBreak(stops, at, column - prefix.length);
    if (cut === null) break;

    lines.push(prefix + body.slice(at, cut));
    at = cut + 1;
    prefix = hanging;
  }

  lines.push(prefix + body.slice(at));
  return lines;
}

/**
 * Every marker a line opens with, in order.
 *
 * Usually one, and sometimes two: a bullet inside a quote is `> - `. Taking
 * only the first would leave the second standing in the text, where it is a
 * legal place to break, and a line broken there is a line holding nothing but
 * markers.
 *
 * @example leading("> - text"); // ["> ", "- "]
 */
function leading(text: string): string[] {
  const markers: string[] = [];

  for (let rest = text; ; ) {
    const marker = MARKER.exec(rest)?.[0];
    if (marker === undefined) return markers;

    markers.push(marker);
    rest = rest.slice(marker.length);
  }
}

/**
 * The last break that fits, or the first one past the edge where none does.
 *
 * A word longer than the column has nowhere to go, an unbroken URL being the
 * case, so it is left standing over the edge rather than cut in the middle.
 */
function nextBreak(stops: number[], from: number, room: number): number | null {
  let last: number | null = null;

  for (const at of stops) {
    if (at <= from) continue;
    if (at - from > room) return last ?? at;
    last = at;
  }

  return last;
}

/**
 * Every space in a line that a break may be put at.
 *
 * Five kinds are not, and each is a place where a newline would change what the
 * markdown says rather than only how it reads. Inside a code span. Inside a
 * link's destination. **Inside a tag**, because an attribute's value carries
 * the newline into the value itself, which is how a hover tooltip written as
 * one sentence became one with a line break in the middle of it. **Inside an
 * image's `![alt]`**, for the same reason, and unlike a link's label, whose
 * text is inline content where a newline really is a space. And in front of
 * anything that opens a block, which would turn the rest of a paragraph into a
 * list.
 *
 * **No space in a run of them is offered at all.** Break in a run and the line
 * before the break keeps the rest of it, and two trailing spaces in markdown
 * are a hard line break: a reader who edited one word of a paragraph carrying
 * three spaces after a full stop would have found a `<br>` in the file that
 * nobody typed.
 */
function breaks(body: string): number[] {
  const stops: number[] = [];
  let code = false;
  let target = false;
  let tag = false;
  let quoted = false;
  let alt = false;

  for (let at = 0; at < body.length; at += 1) {
    const here = body[at];

    if (here === "`") {
      code = !code;
      continue;
    }

    if (code) continue;

    if (tag) {
      if (here === '"') quoted = !quoted;
      else if (here === ">" && !quoted) tag = false;
      continue;
    }

    if (target) {
      if (here === ")") target = false;
      continue;
    }

    if (alt) {
      if (here !== "]") continue;

      alt = false;
      if (body[at + 1] === "(") {
        target = true;
        at += 1;
      }
      continue;
    }

    if (here === "<" && OPENS_TAG.test(body[at + 1] ?? "")) {
      tag = true;
      continue;
    }

    if (here === "!" && body[at + 1] === "[") {
      alt = true;
      at += 1;
      continue;
    }

    if (here === "]" && body[at + 1] === "(") {
      target = true;
      at += 1;
      continue;
    }

    if (here !== " " || at === body.length - 1) continue;
    if (body[at + 1] === " " || body[at - 1] === " ") continue;
    if (OPENS.test(body.slice(at + 1))) continue;

    stops.push(at);
  }

  return stops;
}

/** What has to follow a `<` for it to be a tag rather than a less-than sign. */
const OPENS_TAG = /[A-Za-z/]/;
