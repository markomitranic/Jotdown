"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { segments, type Match } from "./find";

type Props = { match: Match; version: string; pattern: RegExp | null };

/**
 * The markdown source of a result's page, numbered by line, scrolled to where the result is, every match marked.
 *
 * @example <SourcePreview match={selected} version={section.key} pattern={pattern} />
 */
export function SourcePreview({ match, version, pattern }: Props) {
  const source = usePageSource(match.document.markdownUrl, version);
  const target = useRef<HTMLDivElement>(null);
  const lines = typeof source === "string" ? source.split("\n") : [];
  const line = lines.length ? targetLine(lines, match, pattern) : -1;

  // biome-ignore lint/correctness/useExhaustiveDependencies: another result or line scrolls the preview to it again
  useEffect(() => {
    target.current?.scrollIntoView({ block: "center" });
  }, [match.id, line]);

  if (source instanceof Error)
    return (
      <p role="alert" className="px-4 py-3 text-destructive">
        {source.message}
      </p>
    );
  if (source === null) return null;

  const fenced = fencedLines(lines);
  const frontMatter = frontMatterEnd(lines);

  return (
    <div className="py-2 font-mono text-xs leading-5">
      {lines.map((text, at) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: a line's number is its identity
          key={at}
          ref={at === line ? target : undefined}
          className={cn("grid grid-cols-[3.25rem_1fr] pr-4", at === line && "bg-accent")}
        >
          <span aria-hidden="true" className="select-none pr-4 text-right text-muted-foreground/60 tabular-nums">
            {at + 1}
          </span>
          <span
            className={cn(
              "whitespace-pre-wrap break-words",
              (at < frontMatter || fenced.has(at)) && "text-muted-foreground",
              !fenced.has(at) && at >= frontMatter && /^#{1,6}\s/.test(text) && "font-semibold text-foreground",
            )}
          >
            {segments(text, pattern).map((run, n) =>
              run.mark ? (
                <mark
                  // biome-ignore lint/suspicious/noArrayIndexKey: runs of one string, by position, never reordered
                  key={n}
                  className="rounded-[2px] bg-primary/30 text-foreground"
                >
                  {run.text}
                </mark>
              ) : (
                run.text
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The line of the source a result sits on: a page's title, a heading's own line, or the paragraph's line that matched.
 *
 * Search text is the page's prose with its markup taken out, so lines are
 * compared with the markup taken out too. A paragraph is found by the line it
 * starts with, below its heading, and then by the first of its lines that matches.
 *
 * @example targetLine(["---", "title: Guide", "---", "## Setup", "Run it."], setupParagraph, /run/gi); // 4
 */
export function targetLine(lines: string[], match: Match, pattern: RegExp | null) {
  if (match.kind === "page") return firstMatch(lines, pattern, 0, lines.length) ?? 0;

  const body = frontMatterEnd(lines);
  const id = match.url.split("#")[1];
  const heading = id ? match.document.structuredData.headings.find((each) => each.id === id) : undefined;
  const section = (heading && headingLine(lines, heading.content, body)) ?? body;
  if (match.kind === "heading") return section;

  const paragraph = lines.findIndex((text, at) => at >= section && opens(text, flat(match.text)));
  if (paragraph === -1) return firstMatch(lines, pattern, section, lines.length) ?? section;

  const end = lines.findIndex((text, at) => at > paragraph && text.trim() === "");
  return firstMatch(lines, pattern, paragraph, end === -1 ? lines.length : end) ?? paragraph;
}

/** The page's markdown source for this version of its section, fetched once and kept for the session. */
function usePageSource(markdownUrl: string, version: string) {
  const source = useQuery({
    queryKey: ["source", markdownUrl, version],
    queryFn: () => pageSource(markdownUrl),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return source.error ?? source.data ?? null;
}

async function pageSource(markdownUrl: string) {
  const response = await fetch(markdownUrl);
  if (!response.ok) throw new Error("The page's source could not be loaded.");
  return response.text();
}

function headingLine(lines: string[], content: string, from: number) {
  const fenced = fencedLines(lines);
  const wanted = flat(content);
  const at = lines.findIndex(
    (text, n) => n >= from && !fenced.has(n) && /^#{1,6}\s/.test(text) && flat(text) === wanted,
  );
  return at === -1 ? undefined : at;
}

function firstMatch(lines: string[], pattern: RegExp | null, from: number, to: number) {
  if (!pattern) return undefined;
  const at = lines.slice(from, to).findIndex((line) => segments(line, pattern).some((run) => run.mark));
  return at === -1 ? undefined : from + at;
}

/** The index of the first line after the front matter, or 0 for a page without any. */
function frontMatterEnd(lines: string[]) {
  if (lines[0] !== "---") return 0;
  return lines.indexOf("---", 1) + 1;
}

/** Every line inside or opening or closing a code fence. */
function fencedLines(lines: string[]) {
  const fenced = new Set<number>();
  let open = false;
  lines.forEach((text, at) => {
    const fence = /^\s*(```|~~~)/.test(text);
    if (open || fence) fenced.add(at);
    if (fence) open = !open;
  });
  return fenced;
}

/** Whether a source line starts the paragraph, even one wrapped onto more lines, or is the table row holding it as a cell. */
function opens(text: string, paragraph: string) {
  const line = flat(text);
  if (line === "") return false;
  return (
    paragraph.startsWith(line.slice(0, 24)) ||
    (text.trimStart().startsWith("|") && line.includes(paragraph.slice(0, 24)))
  );
}

/**
 * A line as search text reads it: no heading or list marks, tags, link targets or emphasis, one space between words, lowercase.
 *
 * @example flat("## The **sidebar** [tree](./tree.mdx)"); // "the sidebar tree"
 */
function flat(text: string) {
  return text
    .replace(/^\s*(?:#{1,6}|[-*+>]|\d+\.)\s+/, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[*_`~[\]\\|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
