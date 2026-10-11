import { dirOf, isDoc, sectionIndex } from "@jotdown/core/lib/paths";
import type { DocEntry } from "../types";

/**
 * Reports whether changing this page or moving this folder would affect generated content.
 * @example containsGenerated(docs, "docs/api"); // true when it holds a generated page
 */
export function containsGenerated(docs: Record<string, DocEntry>, path: string): boolean {
  return Object.values(docs).some(
    (page) => page.generated && (page.source === path || (!isDoc(path) && page.source.startsWith(`${path}/`))),
  );
}

/**
 * Reports whether a folder holds generated pages of its own, so its order is code's to keep.
 * @example holdsGenerated(docs, "docs/changelog"); // true when a page directly inside is generated
 */
export function holdsGenerated(docs: Record<string, DocEntry>, folder: string): boolean {
  return Object.values(docs).some((page) => page.generated && dirOf(page.source) === folder);
}

/**
 * Reads whether the page behind a sidebar row is generated, including a section's index.
 * @example isGeneratedPage(docs, "docs/api"); // checks docs/api/index.mdx
 */
export function isGeneratedPage(docs: Record<string, DocEntry>, path: string): boolean {
  const file = isDoc(path) ? path : sectionIndex(path);
  return Object.values(docs).some((page) => page.source === file && page.generated === true);
}
