/**
 * Pinning a comment to a run of words on a page, and finding those words again after the page changed.
 *
 * Nothing is written into the page. An anchor keeps the words a reader
 * selected and a little of the text on either side, and every render looks
 * for them in the page's text. Both sides are in squashed form, every run of
 * whitespace one space, so a reflowed paragraph still matches.
 */

/** What a comment is about: the words, and the text just before and after them. */
export type Anchor = { quote: string; prefix: string; suffix: string };

/** Where an anchor's words sit in a page's squashed text, end exclusive. */
export type Span = { start: number; end: number };

/** How much text either side of a quote is kept to tell repeats of it apart. */
export const CONTEXT_LENGTH = 32;

/** Context shorter than this matches too much of any page to find edited words by. */
const BRACKET_MINIMUM = 8;

/**
 * Collapses every run of whitespace to one space, the form anchors are written and searched in.
 *
 * `origins` names, for each character kept, where it sat in the text handed
 * in, so a span found in the squashed text can be pointed back at the page.
 *
 * @example squash("Two\n  lines"); // { text: "Two lines", origins: [0, 1, 2, 3, 6, 7, 8, 9, 10] }
 */
export function squash(raw: string) {
  const kept: string[] = [];
  const origins: number[] = [];

  for (let at = 0; at < raw.length; at++) {
    const char = raw.charAt(at);
    const space = /\s/.test(char);
    if (space && kept.at(-1) === " ") continue;
    kept.push(space ? " " : char);
    origins.push(at);
  }

  return { text: kept.join(""), origins };
}

/**
 * The anchor for a span of a page's squashed text.
 *
 * @example anchorAt("The quick brown fox", 4, 9); // { quote: "quick", prefix: "The ", suffix: " brown fox" }
 */
export function anchorAt(text: string, start: number, end: number): Anchor {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH),
  };
}

/**
 * Finds an anchor's words in a page's squashed text, or null when they are gone.
 *
 * A copy of the words with every character of its surroundings intact is the
 * one. Failing that, edited words standing between the old surroundings win
 * over a copy that only half fits, and a half-fitting copy comes last.
 *
 * @example locate("Go left. Go right.", { quote: "Go", prefix: "left. ", suffix: " right." }); // { start: 9, end: 11 }
 */
export function locate(text: string, anchor: Anchor): Span | null {
  const copy = bestCopy(text, anchor);
  if (copy?.whole) return copy.span;
  return between(text, anchor) ?? copy?.span ?? null;
}

/**
 * The copy of the quote whose surroundings still match best, and whether they match entirely.
 *
 * A copy whose surroundings match nothing only counts when it is the one copy
 * on the page, so edited words are never swapped for the same words elsewhere.
 */
function bestCopy(text: string, { quote, prefix, suffix }: Anchor) {
  if (!quote) return null;

  let span: Span | null = null;
  let bestScore = -1;
  let copies = 0;

  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    const end = at + quote.length;
    const score = sharedBefore(text, at, prefix) + sharedAfter(text, end, suffix);
    copies++;
    if (score > bestScore) {
      span = { start: at, end };
      bestScore = score;
    }
  }

  if (!span || (bestScore === 0 && copies > 1)) return null;
  return { span, whole: bestScore === prefix.length + suffix.length };
}

/** The text now standing between the quote's old surroundings, when the words themselves were edited. */
function between(text: string, { quote, prefix, suffix }: Anchor): Span | null {
  if (prefix.length < BRACKET_MINIMUM || suffix.length < BRACKET_MINIMUM) return null;

  const reach = quote.length * 2 + CONTEXT_LENGTH;
  let best: Span | null = null;

  for (let at = text.indexOf(prefix); at !== -1; at = text.indexOf(prefix, at + 1)) {
    const start = at + prefix.length;
    const end = text.indexOf(suffix, start);
    if (end <= start || end - start > reach) continue;
    if (!best || Math.abs(end - start - quote.length) < Math.abs(best.end - best.start - quote.length))
      best = { start, end };
  }

  return best;
}

/** How many characters just before `at` match the end of `wanted`. */
function sharedBefore(text: string, at: number, wanted: string) {
  let count = 0;
  while (count < wanted.length && count < at && text[at - 1 - count] === wanted[wanted.length - 1 - count]) count++;
  return count;
}

/** How many characters from `at` on match the start of `wanted`. */
function sharedAfter(text: string, at: number, wanted: string) {
  let count = 0;
  while (count < wanted.length && at + count < text.length && text[at + count] === wanted[count]) count++;
  return count;
}
