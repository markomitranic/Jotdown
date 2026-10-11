import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";
import { describeIssues } from "@jotdown/core/lib/broken-file";

/**
 * Every field a page's front matter may carry: Fumadocs' page schema plus `changelog` and `generated`.
 *
 * The schema strips every key it does not name, so a flag left undeclared
 * reaches no remark plugin and no page.
 */
export const pageFrontmatterSchema = pageSchema.extend({
  /** Draw this page as a filterable timeline of releases. */
  changelog: z.boolean().optional(),
  generated: z.boolean().optional(),
  /** The layout the page is drawn in, `docs` and `blank` or one of the project's own; the config's when unset. */
  layout: z.string().min(1).optional(),
});

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

/**
 * A page's front matter, checked, or what is wrong with it in words an author can act on.
 *
 * YAML that will not parse answers with the parser's own message, which names
 * the line and column inside the front matter.
 *
 * @example readPageFrontmatter("---\ntitle: Setup\n---\n").ok; // true
 * @example readPageFrontmatter("# Setup\n"); // { ok: false, problem: "title: Invalid input: expected string, received undefined" }
 */
export function readPageFrontmatter(text: string) {
  let parsed: ReturnType<typeof frontmatter>;
  try {
    parsed = frontmatter(text);
  } catch (error) {
    return {
      ok: false as const,
      problem: `The front matter is not valid YAML. ${error instanceof Error ? error.message : ""}`.trim(),
    };
  }

  const checked = pageFrontmatterSchema.safeParse(parsed.data);
  if (!checked.success) return { ok: false as const, problem: describeIssues(checked.error) };

  return { ok: true as const, data: checked.data, content: parsed.content };
}
