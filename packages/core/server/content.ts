import { contentFiles } from "./files";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import type { Root } from "mdast";
import { executableContent } from "@jotdown/core/lib/content-only";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import type { InternalTypeConfig } from "fumadocs-mdx/runtime/types";
import { dynamic } from "fumadocs-mdx/runtime/dynamic";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";
import { TriangleAlert } from "lucide-react";
import * as config from "@jotdown/core/source.config";
import { dataDirectory, type Project } from "./project";
import { resolvePageIcon } from "@jotdown/core/lib/page-icon";
import { cachedSearchText, hashOf } from "./search";
import { folderMetaSchema, readPageFrontmatter, type PageFrontmatter } from "@jotdown/core/lib/front-matter";
import { readJsonFile, type FileProblem } from "@jotdown/core/lib/broken-file";
import { DOCS_ROOT, MOVED_FILE, inUnderscoreFolder, movesSchema } from "@jotdown/core/lib/paths";
import { orderSections } from "@jotdown/core/lib/sections";

/** The icon a page that could not be read is drawn with in the sidebar. */
const BROKEN_ICON = "jotdown:broken";

type ProjectFile = { path: string; fullPath: string; text: string };
let compiler: ReturnType<typeof dynamic<typeof config, InternalTypeConfig>> | undefined;
const sources = new Map<string, { hash: string; source: ReturnType<typeof loadContent> }>();

/**
 * Discovers a project's content, reusing its page tree while its files are unchanged.
 *
 * Only front matter and `meta.json` are read up front. Each page compiles the
 * first time something renders or indexes it, and requests that arrive while a
 * tree is being built wait for that one build instead of starting their own.
 */
export async function projectSource(project: Project) {
  const root = join(project.directory, "docs");
  const entries = await contentFiles(root);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && (/\.mdx?$/.test(entry.name) || entry.name === "meta.json"))
      .map((entry) => {
        const fullPath = join(entry.parentPath, entry.name);
        return { path: relative(root, fullPath).split("\\").join("/"), fullPath };
      })
      .filter((file) => !inUnderscoreFolder(file.path))
      .map(async (file) => ({ ...file, text: await readFile(file.fullPath, "utf8") })),
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  const moved = await readFile(join(project.directory, MOVED_FILE), "utf8").catch(() => null);
  const hash = createHash("sha256")
    .update(JSON.stringify({ files, projectConfig: project.config, moved }))
    .digest("hex");
  const cached = sources.get(project.id);
  if (cached?.hash === hash) return cached.source;

  const source = loadContent(project, root, files, moved);
  sources.set(project.id, { hash, source });
  source.catch(() => {
    if (sources.get(project.id)?.source === source) sources.delete(project.id);
  });
  return source;
}

/** Refuses a page that would run code, naming the file so the editor knows which one to fix. */
function checkContentOnly(file: ProjectFile) {
  const fail = (problem: string) => new Error(`docs/${file.path}: ${problem}`);

  let tree: Root;
  try {
    tree = unified().use(remarkParse).use(remarkMdx).parse(frontmatter(file.text).content);
  } catch (error) {
    throw fail(error instanceof Error ? error.message : "cannot be compiled.");
  }

  const [first] = executableContent(tree);
  if (first) throw fail(first.reason);
}

/**
 * The section each page belongs to: the deepest folder above it with its own sidebar, or the main tree.
 *
 * @example sectionFinder({ "meta.json": { title: "Docs" }, "manual/meta.json": { title: "Manual", root: true } })("manual/intro.mdx"); // { id: "manual", title: "Manual" }
 */
function sectionFinder(meta: Record<string, { title?: string; root?: string | boolean }>) {
  const home = { id: "", title: meta["meta.json"]?.title ?? "Documentation" };
  const roots = Object.entries(meta)
    .filter(([, data]) => data.root === true)
    .map(([path, data]) => ({ id: dirname(path), title: data.title ?? dirname(path) }))
    .sort((a, b) => b.id.length - a.id.length);

  return (path: string) => roots.find((root) => path.startsWith(`${root.id}/`)) ?? home;
}

/**
 * The layout each page gets from the deepest folder above it whose `meta.json` names one, or none.
 *
 * @example layoutFinder({ "blog/meta.json": { layout: "post" } })("blog/personal/hello.mdx"); // "post"
 */
function layoutFinder(meta: Record<string, { layout?: string }>) {
  const folders = Object.entries(meta)
    .flatMap(([path, { layout }]) => (layout ? [{ prefix: folderPrefix(path), layout }] : []))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return (path: string) => folders.find(({ prefix }) => path.startsWith(prefix))?.layout;
}

/**
 * What every path inside a `meta.json`'s folder starts with, nothing for the docs root.
 *
 * @example folderPrefix("blog/meta.json"); // "blog/"
 */
function folderPrefix(metaPath: string) {
  const folder = dirname(metaPath);
  return folder === "." ? "" : `${folder}/`;
}

/**
 * The name a page is listed under while its own title cannot be read.
 *
 * @example fallbackTitle("guides/setup.mdx"); // "setup"
 * @example fallbackTitle("guides/index.mdx"); // "guides"
 */
function fallbackTitle(path: string) {
  const name = basename(path).replace(/\.mdx?$/, "");
  return name === "index" ? (path.split("/").at(-2) ?? "Home") : name;
}

/** A sidebar icon by name, with the warning a broken page is drawn with. */
function sidebarIcon(name: string | undefined) {
  if (name === BROKEN_ICON) return createElement(TriangleAlert, { className: "text-destructive" });
  return resolvePageIcon(name);
}

/**
 * Builds a page tree from front matter and `meta.json`, leaving every page to compile when first asked.
 *
 * Every page's address starts with the project's base, so the tree links to
 * `/you/notes/manual` in the studio and to `/manual` in a publication.
 *
 * A file that cannot be read fails on its own. A page with broken front matter
 * stays in the tree under its file name, carrying `problem` instead of
 * compiling. Every page knows the layout its nearest folder names. A broken
 * `meta.json` is left out, so its folder lists its pages in their default
 * order, and is reported in `problems` with a broken `docs/moved.json`. An MDX page is checked for code right before its first
 * compile, so it too fails alone.
 */
async function loadContent(project: Project, root: string, projectFiles: ProjectFile[], moved: string | null) {
  const files = new Map<string, ProjectFile>(projectFiles.map((file) => [file.path, file]));
  const problems: FileProblem[] = [];
  const meta: Record<string, ReturnType<typeof folderMetaSchema.parse>> = {};
  const pages: { info: { path: string; fullPath: string }; data: PageFrontmatter }[] = [];
  const broken = new Map<string, string>();

  for (const file of files.values()) {
    const info = { path: file.path, fullPath: file.fullPath };

    if (file.path.endsWith("meta.json")) {
      const read = readJsonFile(folderMetaSchema, file.text);
      if (read.ok) meta[file.path] = read.data;
      else problems.push({ file: `${DOCS_ROOT}/${file.path}`, problem: read.problem });
      continue;
    }

    const read = readPageFrontmatter(file.text);
    if (!read.ok) broken.set(file.path, read.problem);
    pages.push({ info, data: read.ok ? read.data : { title: fallbackTitle(file.path), icon: BROKEN_ICON } });
  }

  const moves = moved === null ? null : readJsonFile(movesSchema, moved);
  if (moves && !moves.ok) problems.push({ file: MOVED_FILE, problem: moves.problem });

  compiler ??= dynamic(config, {
    environment: "runtime",
    configPath: "source.config.ts",
    outDir: join(dataDirectory(), "mdx"),
  });
  const docs = await (await compiler).docs("docs", root, meta, pages);
  for (const page of docs.docs) page.info.fullPath = files.get(page.info.path)?.fullPath ?? join(root, page.info.path);
  for (const meta of docs.meta) meta.info.fullPath = join(root, meta.info.path);

  const sectionOf = sectionFinder(meta);
  const layoutOf = layoutFinder(meta);
  const checked = docs.docs.map((page) => {
    const file = files.get(page.info.path);
    if (!file) throw new Error(`${DOCS_ROOT}/${page.info.path}: compiled without being read`);

    const textHash = hashOf(file.text);
    const problem = broken.get(file.path);

    let checking: Promise<void> | undefined;
    const check = () =>
      (checking ??= Promise.resolve().then(() => {
        if (problem) throw new Error(`${DOCS_ROOT}/${file.path}: ${problem}`);
        if (file.path.endsWith(".mdx")) checkContentOnly(file);
      }));

    return {
      ...page,
      problem,
      section: sectionOf(file.path),
      folderLayout: layoutOf(file.path),
      textHash,
      load: () => check().then(page.load),
      searchText: () => (problem ? Promise.resolve(null) : cachedSearchText(file.path, file.text, textHash)),
    };
  });

  const source = loader({
    baseUrl: project.base || "/",
    source: toFumadocsSource(checked, docs.meta),
    icon: sidebarIcon,
  });
  orderSections(source.getPageTree(), meta["meta.json"]?.pages);

  return Object.assign(source, { problems });
}

/**
 * Every file of a project that could not be read: its broken pages, then the rest, each with where to open it.
 *
 * A page has its own address to open; a `meta.json` or the move record has none.
 *
 * @example sourceProblems(source); // [{ file: "docs/setup.mdx", problem: "title: …", url: "/setup" }, { file: "docs/meta.json", problem: "Not valid JSON. …", url: null }]
 */
export function sourceProblems(source: Awaited<ReturnType<typeof loadContent>>) {
  const pages = source
    .getPages()
    .flatMap((page) =>
      page.data.problem ? [{ file: `${DOCS_ROOT}/${page.path}`, problem: page.data.problem, url: page.url }] : [],
    );
  return [...pages, ...source.problems.map((problem) => ({ ...problem, url: null }))];
}
