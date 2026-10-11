import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import type { Root } from "mdast";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import { structure, type StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import { createSearchAPI, type AdvancedIndex, type SearchAPI } from "fumadocs-core/search/server";
import type { projectSource } from "./content";

/**
 * Search over a project's prose, read from its markdown rather than its compiled pages.
 *
 * Every page's searchable text is parsed out of its file once per version of
 * that file and kept in Next's data cache, one small entry per page. The
 * text is grouped by section, the main tree and each folder with its own
 * sidebar, and each section carries a key that changes only when one of its
 * pages does. The browser downloads a section's text by that key and searches
 * it locally; `/api/search` answers from the same text on the server.
 */

type Source = Awaited<ReturnType<typeof projectSource>>;

/** A section of the project as search sees it: its folder, its sidebar title, and the key of its current text. */
export type SearchSection = { id: string; title: string; key: string };

/** One page as search indexes it, with the file it was read from under `docs/` and where its markdown is served. */
export type SearchDocument = AdvancedIndex & { path: string; markdownUrl: string; structuredData: StructuredData };

/** Where an app serves a page's markdown source, by the page's slugs. */
export type MarkdownUrl = (slugs: string[]) => string;

const TEXT_VERSION = "1";
const DOCUMENT_VERSION = "3";
const PROSE = ["heading", "paragraph", "blockquote", "tableCell"];
const DRAWINGS = new Set(["svg", "img", "picture", "Whiteboard", "VideoEmbed", "FileAttachment"]);

/**
 * The headings and paragraphs a page is found by, or null for a page search leaves out.
 *
 * A changelog is left out, since it has its own search. Everything else is parsed, never compiled: code blocks, Mermaid and the
 * drawings inside figures are dropped, as is a component with no children,
 * whose props are code; prose, lists, table cells and figure captions remain.
 *
 * @example extractSearchText("guide.mdx", "---\ntitle: Guide\n---\n\n## Setup\n\nRun it.\n"); // { headings: [{ id: "setup", content: "Setup" }], contents: [{ heading: "setup", content: "Run it." }] }
 */
export function extractSearchText(path: string, text: string): StructuredData | null {
  const { content, data } = frontmatter(text) as {
    content: string;
    data: { changelog?: unknown };
  };
  if (data.changelog === true) return null;

  const plugins = path.endsWith(".mdx")
    ? [remarkMdx, remarkDirective, remarkWithoutDrawings]
    : [remarkDirective, remarkWithoutDrawings];
  return structure(content, plugins, { types: PROSE });
}

/** Takes drawings, images, embeds and attachments out of a page's tree, so their markup never reaches search. */
function remarkWithoutDrawings() {
  return (tree: Root) => {
    const prune = (node: { children?: unknown[] }) => {
      if (!node.children) return;
      node.children = node.children.filter((child) => !isDrawing(child));
      for (const child of node.children) prune(child as { children?: unknown[] });
    };
    prune(tree);
  };
}

function isDrawing(node: unknown) {
  const { type, name } = node as { type: string; name?: string | null };
  return (type === "mdxJsxFlowElement" || type === "mdxJsxTextElement") && DRAWINGS.has(name ?? "");
}

/**
 * A page's search text through Next's data cache, keyed by the hash of its file.
 *
 * The same file always yields the same text, so each version of a page is
 * parsed once for every server instance and every deploy.
 *
 * @example await cachedSearchText("guide.mdx", text, hashOf(text)); // { headings: […], contents: […] }
 */
export function cachedSearchText(path: string, text: string, hash: string) {
  return unstable_cache(async () => extractSearchText(path, text), ["search-text", TEXT_VERSION, hash])();
}

/**
 * The hash a page's text is cached and keyed by.
 *
 * @example hashOf("# Hello"); // "0d4b…"
 */
export function hashOf(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Every section of the project with a page in search, the main tree first, keyed by its pages' current text.
 *
 * The key also carries the version of the shape a page is sent to the browser
 * in, since the browser keeps a section's text for good under its key. Bump
 * `DOCUMENT_VERSION` whenever that shape changes.
 *
 * @example searchSections(source); // [{ id: "", title: "Documentation", key: "9f2c…" }, { id: "manual", title: "Docs manual", key: "41ab…" }]
 */
export function searchSections(source: Source): SearchSection[] {
  const sections = new Map<string, { title: string; hash: ReturnType<typeof createHash> }>();

  for (const page of source.getPages()) {
    if (page.data.changelog) continue;
    const { id, title } = page.data.section;
    const section = sections.get(id) ?? { title, hash: createHash("sha256").update(`${DOCUMENT_VERSION}\n`) };
    section.hash.update(`${page.url}\n${page.data.textHash}\n`);
    sections.set(id, section);
  }

  return [...sections]
    .map(([id, { title, hash }]) => ({ id, title, key: hash.digest("hex").slice(0, 16) }))
    .sort((a, b) => (a.id === "" ? -1 : b.id === "" ? 1 : a.title.localeCompare(b.title)));
}

/**
 * Every searchable page of one section, or of the whole project, ready to index.
 *
 * @example await searchDocuments(source, markdownUrl, "manual"); // [{ id: "/manual", url: "/manual", path: "manual/index.mdx", markdownUrl: "/llms.mdx/manual", title: "Overview", tag: "manual", structuredData: {…} }, …]
 */
export async function searchDocuments(
  source: Source,
  markdownUrl: MarkdownUrl,
  section?: string,
): Promise<SearchDocument[]> {
  const pages = source
    .getPages()
    .filter((page) => !page.data.changelog && (section === undefined || page.data.section.id === section));

  const documents = await Promise.all(
    pages.map(async (page) => {
      const structuredData = await page.data.searchText();
      if (!structuredData) return null;

      const { id, title } = page.data.section;
      return {
        id: page.url,
        url: page.url,
        path: page.path,
        markdownUrl: markdownUrl(page.slugs),
        title: page.data.title,
        description: page.data.description,
        tag: id,
        breadcrumbs: id ? [title] : [],
        structuredData,
      };
    }),
  );

  return documents.filter((document) => document !== null);
}

const servers = new WeakMap<Source, SearchAPI>();

/**
 * The server's own index of the project, built once per page tree, for `/api/search`.
 *
 * @example await projectSearch(source, markdownUrl).GET(request); // Response with [{ type: "page", url: "/manual/sections", … }, …]
 */
export function projectSearch(source: Source, markdownUrl: MarkdownUrl) {
  const known = servers.get(source);
  if (known) return known;

  const server = createSearchAPI("advanced", {
    indexes: () => searchDocuments(source, markdownUrl),
    language: "english",
  });
  servers.set(source, server);
  return server;
}
