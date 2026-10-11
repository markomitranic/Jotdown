import type { SortedResult } from "fumadocs-core/search";
import type { SearchDocument } from "@jotdown/core/server/search";

/**
 * What a search finds, and how it reads the query.
 *
 * With every option off the query is words, ranked by the search index, which
 * forgives a typo and a plural. Turning on match case, whole words or regex
 * reads the query as text instead, and every page's prose is scanned for it,
 * the way a code editor's find in files does.
 */

/** The three ways of reading the query as text rather than as words. */
export type FindOptions = { matchCase: boolean; words: boolean; regex: boolean };

/** One result: a page title, a heading or a paragraph, where it links to, and the page it is on. */
export type Match = {
  id: string;
  kind: "page" | "heading" | "text";
  url: string;
  text: string;
  document: SearchDocument;
};

/** A run of a result's text, marked when it is what the query matched. */
export type Segment = { text: string; mark: boolean };

/** The most results a literal search lists, since a one-letter regex matches every paragraph. */
export const LITERAL_LIMIT = 500;

/**
 * Whether the query is read as text to scan for, rather than as words to rank.
 *
 * @example isLiteral({ matchCase: false, words: true, regex: false }); // true
 */
export function isLiteral(options: FindOptions) {
  return options.matchCase || options.words || options.regex;
}

/**
 * The pattern that marks what matched, or null for an empty query or a regex that does not parse.
 *
 * Read as words, each word is marked wherever it appears, in any case. Read as
 * text, the query is the pattern, with the options applied.
 *
 * @example queryPattern("side bar", { matchCase: false, words: false, regex: false }); // /side|bar/gi
 */
export function queryPattern(query: string, options: FindOptions) {
  if (query.trim() === "") return null;

  if (!isLiteral(options)) {
    const words = [...new Set(query.trim().split(/\s+/))].map(escapeRegExp);
    return new RegExp(words.join("|"), "gi");
  }

  const source = options.regex ? query : escapeRegExp(query);
  const bounded = options.words ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(bounded, options.matchCase ? "g" : "gi");
  } catch {
    return null;
  }
}

/**
 * Every title, heading and paragraph the pattern matches, in page order, optionally in one section.
 *
 * @example findLiteral(documents, /Sidebar/g); // [{ kind: "heading", url: "/manual/sections#the-sidebar", text: "The sidebar", … }, …]
 */
export function findLiteral(documents: SearchDocument[], pattern: RegExp, section?: string): Match[] {
  const matches: Match[] = [];

  for (const document of documents) {
    if (section !== undefined && document.tag !== section) continue;

    const { url, title, description, structuredData } = document;
    const entries = [
      { kind: "page" as const, url, text: title },
      ...(description ? [{ kind: "text" as const, url, text: description }] : []),
      ...structuredData.headings.map((heading) => ({
        kind: "heading" as const,
        url: `${url}#${heading.id}`,
        text: heading.content,
      })),
      ...structuredData.contents.map((content) => ({
        kind: "text" as const,
        url: content.heading ? `${url}#${content.heading}` : url,
        text: content.content,
      })),
    ];

    entries.forEach((entry, at) => {
      if (hasMatch(entry.text, pattern)) matches.push({ ...entry, id: `${url}:${at}`, document });
    });
    if (matches.length >= LITERAL_LIMIT) break;
  }

  return matches.slice(0, LITERAL_LIMIT);
}

/**
 * The search index's ranked results as matches, dropping a page's own row when its headings or paragraphs matched.
 *
 * @example fromRanked(await index.search("sidebar", {}), documentsByUrl); // [{ kind: "heading", text: "The sidebar", … }, …]
 */
export function fromRanked(results: SortedResult[], documents: Map<string, SearchDocument>): Match[] {
  const pagesWithHits = new Set(
    results.filter((result) => result.type !== "page").map((result) => pageUrl(result.url)),
  );

  return results.flatMap((result) => {
    const document = documents.get(pageUrl(result.url));
    if (!document) return [];
    if (result.type === "page" && pagesWithHits.has(document.url)) return [];
    return [{ id: result.id, kind: result.type, url: result.url, text: plainText(result.content), document }];
  });
}

/**
 * The text cut into runs, with every non-empty match of the pattern marked.
 *
 * @example segments("Open the sidebar", /side/gi); // [{ text: "Open the ", mark: false }, { text: "side", mark: true }, { text: "bar", mark: false }]
 */
export function segments(text: string, pattern: RegExp | null): Segment[] {
  if (!pattern) return [{ text, mark: false }];

  const runs: Segment[] = [];
  let at = 0;
  for (const found of text.matchAll(pattern)) {
    if (!found[0]) continue;
    if (found.index > at) runs.push({ text: text.slice(at, found.index), mark: false });
    runs.push({ text: found[0], mark: true });
    at = found.index + found[0].length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), mark: false });
  return runs;
}

/**
 * The text from a word or so before its first match, so a match deep in a long paragraph still shows in one line.
 *
 * @example snippet("A very long paragraph … that finally mentions the sidebar", /sidebar/gi); // "…finally mentions the sidebar"
 */
export function snippet(text: string, pattern: RegExp | null) {
  const first = pattern ? [...text.matchAll(pattern)].find((found) => found[0])?.index : undefined;
  if (first === undefined || first <= 48) return text;

  const space = text.indexOf(" ", first - 32);
  const start = space !== -1 && space < first ? space + 1 : first - 32;
  return `…${text.slice(start)}`;
}

function hasMatch(text: string, pattern: RegExp) {
  return segments(text, pattern).some((run) => run.mark);
}

function pageUrl(url: string) {
  return url.split("#")[0] ?? url;
}

function plainText(markdown: string) {
  return markdown.replace(/<\/?mark>/g, "").replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1");
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
