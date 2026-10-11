/**
 * Finding, rewriting and removing the links in a markdown document.
 *
 * Pure string work over text, shared by the two things that care where a link
 * points: the structure endpoint, which repairs links when a page moves and
 * unwrites them when one is deleted, and `scripts/check-links.ts`, which reads
 * the same links to say which of them point at nothing.
 *
 * One copy is the point. A regex here that missed reference definitions would
 * make the endpoint leave a stale link behind and the checker stay quiet about
 * it, which is the pair of bugs that hides the longest.
 */

/**
 * Matches the target of an inline link, an image, or a reference definition.
 *
 * Three groups because the target has to come back out with whatever wrapped
 * it. Angle-bracketed targets and titles after the URL are left alone: neither
 * appears in these docs, and a regex that tried to cover every markdown link
 * would start rewriting code samples.
 *
 * The three spaces are CommonMark's: a definition indented four or more is an
 * indented code block instead. Matching any indent read `[key: string]: unknown`
 * in a TypeScript sample as a definition pointing at `unknown`.
 */
const LINK_TARGET = /(\]\(|^ {0,3}\[[^\]]+\]:[ \t]*)([^)\s]+)(\)|$)/gm;

/** Whether one `LINK_TARGET` match is a reference definition rather than an inline link. */
const isDefinition = (open: string) => open !== "](";

/**
 * Matches a whole inline link, label included, so it can be taken apart.
 *
 * The leading `!` is captured rather than excluded, because an image shares
 * this shape and the caller has to be able to tell the two apart.
 */
const INLINE_LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;

/** An href pointing at something with a name of its own, which nothing here moves. */
export const UNTOUCHABLE = /^(?:[a-z][a-z0-9+.-]*:|#|\/img\/|\/files\/)/i;

/**
 * A page linked by bare file name, with no folder in front of it.
 *
 * Fumadocs looks a link up in the page tree only when it starts with `./` or
 * `../`, so `[Form](Form.md)` renders as an href pointing nowhere. TypeDoc
 * writes that spelling for every page it generates, and `source.config.ts`
 * puts the `./` in before the link is compiled.
 *
 * Deliberately narrow: an href ending in `.md` or `.mdx`, with no scheme, no
 * leading slash and no `./` already on it. Everything else is left as the
 * author wrote it.
 *
 * @example BARE_PAGE_LINK.test("Form.md#send"); // true
 * @example BARE_PAGE_LINK.test("./Form.md"); // false
 */
export const BARE_PAGE_LINK = /^(?!\/|#|\.{1,2}\/|[a-z][a-z0-9+.-]*:)[^#?]*\.mdx?(?:#.*)?$/i;

/** Rewrites every link target in a document, leaving the text around it alone. */
export function rewriteTargets(text: string, rewrite: (target: string) => string) {
  const fenced = fencedLines(text);

  return text.replace(LINK_TARGET, (whole, open: string, target: string, close: string, at: number) => {
    if (isDefinition(open) && fenced.has(lineAt(text, at + open.length))) return whole;

    const next = rewrite(target);
    return next === target ? whole : `${open}${next}${close}`;
  });
}

/**
 * Turns the links a caller rejects back into the words they were written as.
 *
 * `[the BFF page](./bff.mdx)` becomes `the BFF page`, which is what somebody
 * editing by hand would be left with once the page it pointed at is gone. Only
 * inline links are unwritten: an image keeps its own file, and a reference
 * definition is a line of its own that the checker reports rather than a
 * sentence this can repair without reading the paragraph around it.
 *
 * @example unlink("See [BFF](./bff.mdx).", () => true); // "See BFF."
 */
export function unlink(text: string, rejects: (target: string) => boolean) {
  return text.replace(INLINE_LINK, (whole, image: string, label: string, target: string) =>
    image || !rejects(target) ? whole : label,
  );
}

/** One link as the checker reads it: where it points, and where it was written. */
export type FoundLink = { target: string; line: number };

/**
 * Every link target in a document, each with the line it sits on.
 *
 * The line is counted to where the target starts rather than to where the match
 * did, so the indent in front of a reference definition does not shift it.
 * An inline link inside a code fence is still reported, deliberately: a fence
 * showing `[text](./missing.mdx)` is a broken link a reader can click.
 *
 * @example linksIn("See [BFF](./bff.mdx)."); // [{ target: "./bff.mdx", line: 1 }]
 */
export function linksIn(text: string): FoundLink[] {
  const fenced = fencedLines(text);

  return [...text.matchAll(LINK_TARGET)].flatMap((match) => {
    const [, lead, target] = match;
    if (lead === undefined || target === undefined) return [];

    const line = lineAt(text, match.index + lead.length);
    const hidden = isDefinition(lead) && fenced.has(line);

    return hidden ? [] : [{ target, line }];
  });
}

/**
 * The `href` of every JSX tag in a document, which markdown syntax never sees.
 *
 * `<FileAttachment href="/files/docs/9f2c.zip" />` is a link the reader can
 * click and a file that can go missing, so the checker has to look at it, and
 * `linksIn` never will: to markdown it is a paragraph of text.
 */
export function attributeLinksIn(text: string): FoundLink[] {
  return [...text.matchAll(/\bhref=["']([^"']+)["']/g)].flatMap((match) => {
    const [, target] = match;
    return target === undefined ? [] : [{ target, line: lineAt(text, match.index) }];
  });
}

/** Splits `./bff.mdx#pooling` into its path and its anchor. */
export function splitHash(target: string): [string, string?] {
  const at = target.indexOf("#");
  return at === -1 ? [target] : [target.slice(0, at), target.slice(at)];
}

/** Drops the trailing slash a URL only has when it is the site root. */
export function stripSlash(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

/** @example lineAt("a\nb", 2); // 2 */
function lineAt(text: string, index: number) {
  let line = 1;
  for (let at = 0; at < index; at++) if (text[at] === "\n") line++;
  return line;
}

/**
 * The 1-based lines a fenced code block covers, its two fence lines included.
 *
 * A link reference definition cannot exist inside a fence, so anything shaped
 * like one in there is a code sample. A closing fence is the same character as
 * the opening one and at least as long, which is all CommonMark asks of it.
 *
 * @example fencedLines("```ts\n[k: string]: unknown;\n```\n"); // Set { 1, 2, 3 }
 */
function fencedLines(text: string): Set<number> {
  const inside = new Set<number>();
  let open = "";

  text.split("\n").forEach((row, at) => {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(row)?.[1] ?? "";
    if (!open && !fence) return;

    inside.add(at + 1);
    if (!open) open = fence;
    else if (fence.startsWith(open.charAt(0)) && fence.length >= open.length) open = "";
  });

  return inside;
}
