/**
 * Lints one docs file on its own, for what breaks the page and what strays from the house style.
 *
 * A page's front matter is checked against the page schema, its body parsed
 * as MDX and searched for anything that would run code, and a `meta.json`
 * checked against the folder schema. Errors are what a reader would meet as a
 * broken page; warnings are authoring rules a page renders fine without.
 */
import { basename } from "node:path";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node, Point } from "unist";
import { VFileMessage } from "vfile-message";
import { YAMLParseError } from "yaml";
import { readJsonFile } from "@jotdown/core/lib/broken-file";
import { executableContent } from "@jotdown/core/lib/content-only";
import { folderMetaSchema, pageFrontmatterSchema } from "@jotdown/core/lib/front-matter";
import { DOCS_ROOT, META_FILE, isMdx, metaPath } from "@jotdown/core/lib/paths";

/** Every rule, and whether what it finds breaks a page or only strays from the house style. */
export const LINT_RULES = {
  "front-matter": "error",
  mdx: "error",
  "content-only": "error",
  meta: "error",
  "listed-index": "warning",
  description: "warning",
  "unknown-field": "warning",
  "page-heading": "warning",
  "code-link": "warning",
  "md-component": "warning",
} as const;

export type LintRule = keyof typeof LINT_RULES;

/** One problem in a file, placed the way an editor jumps to it. */
export type LintProblem = { line: number; column: number; message: string; rule: LintRule };

const KNOWN_FIELDS = new Set(Object.keys(pageFrontmatterSchema.shape));

/**
 * Every problem in one docs file, a page or a `meta.json`, in the order they appear.
 *
 * @example lintFile("docs/a.mdx", "---\ntitle: A\ndescription: B\n---\n\n{alert(1)}\n")[0].rule; // "content-only"
 * @example lintFile("docs/meta.json", '{ "pages": ["index"] }'); // []
 */
export function lintFile(path: string, text: string): LintProblem[] {
  if (basename(path) === META_FILE) return metaProblems(path, text);

  const front = frontMatterProblems(text);
  const parsed = parse(path, text);
  const tree = parsed.tree;

  const executable = tree && isMdx(path) ? executableContent(tree) : [];
  const style = tree && front.handWritten ? styleProblems(path, tree) : [];

  return [
    ...front.problems,
    ...parsed.problems,
    ...executable.map(({ reason, place }) => problem(place?.start, reason, "content-only")),
    ...style,
  ].sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * A page's front matter checked against the page schema, each complaint on the line of the field it names.
 *
 * Generated pages and changelogs are not written by hand, so they skip the warnings.
 */
function frontMatterProblems(text: string) {
  let data: unknown;
  try {
    data = frontmatter(text).data;
  } catch (error) {
    if (!(error instanceof YAMLParseError)) throw error;

    const [first = ""] = error.message.split("\n");
    const reason = `The front matter is not valid YAML: ${first.replace(/ at line \d+, column \d+:?$/, "")}.`;
    const place = error.linePos && { line: error.linePos[0].line + 1, column: error.linePos[0].col };
    return { handWritten: false, problems: [problem(place, reason, "front-matter")] };
  }

  const checked = pageFrontmatterSchema.safeParse(data);
  if (!checked.success) {
    const problems = checked.error.issues.map((issue) => {
      const field = issue.path.join(".");
      const message = field ? `${field}: ${issue.message}` : issue.message;
      return problem({ line: fieldLine(text, String(issue.path[0] ?? "")) }, message, "front-matter");
    });
    return { handWritten: false, problems };
  }

  const { generated, changelog, description } = checked.data;
  if (generated || changelog) return { handWritten: false, problems: [] };

  const unknown = Object.keys(data ?? {})
    .filter((field) => !KNOWN_FIELDS.has(field))
    .map((field) =>
      problem({ line: fieldLine(text, field) }, `${field}: does nothing in a Jotdown page.`, "unknown-field"),
    );

  const undescribed = description
    ? []
    : [problem(undefined, "No description, which search results and section cards show.", "description")];

  return { handWritten: true, problems: [...undescribed, ...unknown] };
}

/**
 * The authoring rules a page breaks while still rendering, found in its parsed tree.
 *
 * A `#` heading repeats the title the page already draws, a link in backticks
 * renders as code instead of a link, and a component in a `.md` file renders
 * as nothing at all.
 */
function styleProblems(path: string, tree: Root) {
  const found: LintProblem[] = [];
  const markdown = !isMdx(path);

  const walk = (node: Node & { children?: Node[]; value?: unknown; depth?: number }) => {
    const value = typeof node.value === "string" ? node.value : "";
    const place = node.position?.start;

    if (node.type === "heading" && node.depth === 1) {
      found.push(
        problem(place, "A # heading repeats the page's title. Start the page's headings at ##.", "page-heading"),
      );
    }

    if (node.type === "inlineCode" && /^!?\[[^\]]*\]\([^)\s]+\)$/.test(value)) {
      found.push(problem(place, "A link in backticks renders as code. Drop the backticks.", "code-link"));
    }

    if (markdown && node.type === "html" && /^<[A-Z]/.test(value)) {
      found.push(
        problem(place, "A component in a .md page renders as nothing. Rename the page to .mdx.", "md-component"),
      );
    }

    node.children?.forEach(walk);
  };

  walk(tree);
  return found;
}

/**
 * The line a top-level front matter field is written on, or the first line when it is missing.
 *
 * @example fieldLine("---\ntitle: A\nicon: 3\n---\n", "icon"); // 3
 * @example fieldLine("---\ntitle: A\n---\n", "description"); // 1
 */
function fieldLine(text: string, field: string) {
  const lines = text.split(/\r?\n/);
  const end = lines.indexOf("---", 1);
  const at = lines.slice(0, end).findIndex((line) => field !== "" && line.startsWith(`${field}:`));
  return at === -1 ? 1 : at + 1;
}

/** A page parsed the way it compiles, `.mdx` as MDX and `.md` as markdown, or the parser's complaint. */
function parse(path: string, text: string): { tree?: Root; problems: LintProblem[] } {
  const parser = unified().use(remarkParse).use(remarkFrontmatter);
  if (isMdx(path)) parser.use(remarkMdx);

  try {
    return { tree: parser.parse(text), problems: [] };
  } catch (error) {
    if (!(error instanceof VFileMessage)) throw error;
    return { problems: [problem({ line: error.line ?? 1, column: error.column ?? 1 }, error.reason, "mdx")] };
  }
}

/**
 * A `meta.json` checked against the folder schema Fumadocs reads it with.
 *
 * An ordinary folder's `index.mdx` is already the folder row's own page, so
 * listing `"index"` there takes the page off the row and adds it again as a
 * child. Only the docs root and `"root": true` sections list it.
 */
function metaProblems(path: string, text: string) {
  const read = readJsonFile(folderMetaSchema, text);
  if (!read.ok) return [problem(undefined, read.problem, "meta")];

  const { root, pages = [] } = read.data;
  const docsRoot = path === metaPath(DOCS_ROOT) || path.endsWith(`/${metaPath(DOCS_ROOT)}`);
  if (root || docsRoot || !pages.includes("index")) return [];

  const at = text.split(/\r?\n/).findIndex((line) => line.includes('"index"'));
  const message = 'Listing "index" turns the folder\'s own page into a child row. Drop it from pages.';
  return [problem(at === -1 ? undefined : { line: at + 1 }, message, "listed-index")];
}

/**
 * One problem at a place in the file, the first line and column when the place is unknown.
 *
 * @example problem({ line: 3 }, "Unexpected character", "mdx"); // { line: 3, column: 1, … }
 */
function problem(place: Partial<Point> | undefined, message: string, rule: LintRule): LintProblem {
  return { line: place?.line ?? 1, column: place?.column ?? 1, message, rule };
}
