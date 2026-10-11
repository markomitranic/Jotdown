import type { SourcePage } from "@jotdown/core/components/CompiledPage";
import type { ProjectConfig } from "@jotdown/core/server/config";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { markdownUrl } from "@/lib/markdown-url";
import type { StudioProject } from "@/server/storage";

/**
 * Where one page lives, for the editor: its file, its markdown twin, and its addresses on GitHub and on the site.
 *
 * @example pageTarget(project, page); // { path: "docs/guides/setup.mdx", localPath: "site/docs/guides/setup.mdx", title: "Setup", … }
 */
export function pageTarget(project: StudioProject, page: SourcePage) {
  const path = `${DOCS_ROOT}/${page.path}`;
  return {
    path,
    localPath: project.config.content ? `${project.config.content}/${path}` : path,
    title: page.data.title,
    markdownUrl: markdownUrl(project.base, page.slugs),
    githubUrl: project.fileUrl ? project.fileUrl + path : "",
    publicUrl: publishedUrl(project.config, page.slugs),
    generated: page.data.generated,
  };
}

/**
 * Where readers open a page on the site, or empty when the config names no `url`.
 *
 * @example publishedUrl(config, ["guides", "setup"]); // "https://handbook.your-org.com/guides/setup"
 */
function publishedUrl({ url }: ProjectConfig, slugs: string[]) {
  return url ? [url.replace(/\/$/, ""), ...slugs].join("/") : "";
}
