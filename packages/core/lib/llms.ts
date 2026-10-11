import type { Source } from "@jotdown/core/components/CompiledPage";
import type { Project } from "@jotdown/core/server/project";

/**
 * The text of `/llms.txt`, the index an agent reads first: every page as a title, its markdown twin and its description.
 *
 * Each address is the page's markdown twin, so the follow-up fetch lands on
 * the source text rather than on HTML. `notes` are extra lines under the
 * heading, for what only one app offers.
 *
 * @example llmsIndex(project, source, (slugs) => `/markdown/${slugs.join("/")}.md`); // "# Handbook\n\n> Every page…"
 */
export function llmsIndex(
  { config }: Project,
  source: Source,
  twin: (slugs: string[]) => string,
  notes: string[] = [],
) {
  const pages = source.getPages().sort((a, b) => a.url.localeCompare(b.url));

  const lines = [
    `# ${config.title}`,
    "",
    "> Every page of this site, linked as its own markdown source.",
    ...notes,
    "",
    ...pages.map((page) => {
      const description = page.data.description?.trim();
      return description
        ? `- [${page.data.title}](${twin(page.slugs)}): ${description}`
        : `- [${page.data.title}](${twin(page.slugs)})`;
    }),
  ];

  return `${lines.join("\n")}\n`;
}
