import { parse } from "yaml";
import { pageFrontmatterSchema, readPageFrontmatter } from "@jotdown/core/lib/front-matter";
import { frontmatterLine, patchFrontmatterField, readFrontmatterField } from "@jotdown/editor/markdown/frontmatter";

/** The front matter fields the repair form asks for. */
export type FrontmatterFields = { title: string; description: string; icon: string };

const FORM_KEYS = ["title", "description", "icon"];
const HEADER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const TOP_LEVEL_KEY = /^["']?([A-Za-z_][\w-]*)["']?[ \t]*:/gm;

/**
 * A page's text cut into the lines between its front matter fences and everything after.
 *
 * A byte order mark in front of the fence is dropped, since it is what keeps
 * the front matter from being read in the first place.
 *
 * @example splitFrontmatter("---\ntitle: A\n---\n\nBody\n"); // { lines: "title: A", body: "\nBody\n" }
 * @example splitFrontmatter("# Body\n"); // { lines: null, body: "# Body\n" }
 */
function splitFrontmatter(text: string) {
  const unmarked = text.replace(/^\uFEFF/, "");
  const header = HEADER.exec(unmarked);
  return header ? { lines: header[1] ?? "", body: unmarked.slice(header[0].length) } : { lines: null, body: unmarked };
}

/**
 * Whatever of the form's fields can still be read out of a page's front matter, even when it is not valid YAML.
 *
 * @example prefillFields("---\ntitle: Setup: the basics\n---\n"); // { title: "Setup: the basics", description: "", icon: "" }
 */
export function prefillFields(text: string): FrontmatterFields {
  const { lines } = splitFrontmatter(text);
  if (lines === null) return { title: "", description: "", icon: "" };

  return {
    title: readFrontmatterField(lines, "title") ?? "",
    description: readFrontmatterField(lines, "description") ?? "",
    icon: readFrontmatterField(lines, "icon") ?? "",
  };
}

/**
 * The page's text with front matter that reads, built from the form's fields, and the other fields it had to drop.
 *
 * Tries the gentlest repair first: the fields written where they stand, then
 * written anew, then without the other fields the schema rejects, and last a
 * front matter of the form's fields alone. The body is never touched.
 *
 * @example repairFrontmatter("---\ntitle: A: B\n---\n\nBody\n", { title: "A: B", description: "", icon: "" }); // { text: '---\ntitle: "A: B"\n---\n\nBody\n', dropped: [] }
 */
export function repairFrontmatter(text: string, fields: FrontmatterFields) {
  const { lines, body } = splitFrontmatter(text);
  const gap = lines === null && body && !body.startsWith("\n") ? "\n" : "";
  const compose = (header: string) => `---\n${header}\n---\n${gap}${body}`;

  const fresh = [
    frontmatterLine("title", fields.title.trim()),
    fields.description.trim() && frontmatterLine("description", fields.description.trim()),
    fields.icon.trim() && frontmatterLine("icon", fields.icon.trim()),
  ]
    .filter(Boolean)
    .join("\n");

  const candidates =
    lines === null
      ? [fresh]
      : [
          withFields(lines, fields),
          withFields(withoutFields(lines), fields),
          withoutRejected(withFields(withoutFields(lines), fields)),
          fresh,
        ];
  const header = candidates.find((candidate) => readPageFrontmatter(compose(candidate)).ok) ?? fresh;

  return {
    text: compose(header),
    dropped: keysOf(lines ?? "").filter((key) => !FORM_KEYS.includes(key) && !keysOf(header).includes(key)),
  };
}

/** The front matter lines with the form's fields written in, an empty field taken out. */
function withFields(lines: string, fields: FrontmatterFields) {
  const titled = patch(lines, "title", fields.title.trim() || null);
  const described = patch(titled, "description", fields.description.trim() || null);
  return patch(described, "icon", fields.icon.trim() || null);
}

/** One field written into the lines, starting them when there are none left. */
function patch(lines: string, key: string, value: string | null) {
  if (lines.trim()) return patchFrontmatterField(lines, key, value);
  return value === null ? "" : frontmatterLine(key, value);
}

/** The front matter lines without the form's fields, so they can be written anew. */
function withoutFields(lines: string) {
  const untitled = patchFrontmatterField(lines, "title", null);
  const undescribed = patchFrontmatterField(untitled, "description", null);
  return patchFrontmatterField(undescribed, "icon", null);
}

/** The front matter lines without each top-level field the page schema refuses. */
function withoutRejected(lines: string) {
  let data: unknown;
  try {
    data = parse(lines);
  } catch {
    return lines;
  }

  const checked = pageFrontmatterSchema.safeParse(data ?? {});
  if (checked.success) return lines;

  const rejected = new Set(checked.error.issues.map((issue) => issue.path[0]).filter((key) => typeof key === "string"));
  return [...rejected].reduce((kept, key) => patchFrontmatterField(kept, key, null), lines);
}

/** The top-level keys a block of front matter names. */
function keysOf(lines: string) {
  return [...lines.matchAll(TOP_LEVEL_KEY)].flatMap((match) => match[1] ?? []);
}
