import { initAdvancedSearch } from "fumadocs-core/search/server";
import type { SearchDocument, SearchSection } from "@jotdown/core/server/search";

/**
 * The project's search index, built in the browser from each section's text.
 *
 * A section's text is fetched by its key, which the browser caches for good,
 * so a new commit only downloads the sections it changed. The index is built
 * once per set of keys and reused for every keystroke after.
 */

type BrowserIndex = { documents: Promise<SearchDocument[]>; index: ReturnType<typeof initAdvancedSearch> };

const texts = new Map<string, Promise<SearchDocument[]>>();
let built: ({ key: string } & BrowserIndex) | undefined;

/**
 * The index over one project's sections and the pages it was built from, started now and shared until a key changes.
 *
 * @example await browserIndex("/you/notes", sections).index.search("sidebar", {}); // [{ type: "page", url: "/you/notes/manual/sections", … }, …]
 */
export function browserIndex(base: string, sections: SearchSection[]): BrowserIndex {
  const key = `${base}:${sections.map((section) => `${section.id}@${section.key}`).join(",")}`;
  if (built?.key === key) return built;

  const documents = Promise.all(sections.map((section) => sectionText(base, section))).then((each) => each.flat());
  const index = initAdvancedSearch({ indexes: () => documents, language: "english" });
  built = { key, documents, index };
  return built;
}

/** Forgets the index, so the next search starts over after a download failed. */
export function forgetIndex() {
  built = undefined;
}

/**
 * One section's search text, downloaded once and shared until the download fails.
 *
 * Fetched against the page's origin rather than its address, since a browser
 * refuses a relative fetch from a page opened as `https://user:pass@host`.
 *
 * @example await sectionText("/you/notes", section); // [{ id: "/you/notes/manual", … }, …]
 */
function sectionText(base: string, section: SearchSection) {
  const address = sectionAddress(base, section);
  const known = texts.get(address);
  if (known) return known;

  const text = fetch(new URL(address, location.origin)).then((response) => {
    if (!response.ok) throw new Error(`Search could not load ${section.title}.`);
    return response.json() as Promise<SearchDocument[]>;
  });
  texts.set(address, text);
  text.catch(() => texts.delete(address));
  return text;
}

/**
 * Where one section's text is served, named by its key so an address never changes what it answers.
 *
 * @example sectionAddress("/you/notes", { id: "guides/api", title: "API", key: "41ab" }); // "/you/notes/api/search/section/41ab/guides/api"
 */
function sectionAddress(base: string, section: SearchSection) {
  const folders = section.id ? section.id.split("/").map(encodeURIComponent) : [];
  return [`${base}/api/search/section`, section.key, ...folders].join("/");
}
