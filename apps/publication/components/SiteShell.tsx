import type { ReactNode } from "react";
import { DocsShell, SidebarFooter } from "@jotdown/core/components/DocsShell";
import { ProjectTitle } from "@jotdown/core/components/ProjectLook";
import { PublishSearchSections } from "@jotdown/core/components/search/ProjectSearch";
import { searchSections } from "@jotdown/core/server/search";
import { sectionTabs } from "@jotdown/core/lib/sections";
import { publication, publicationSource } from "@/server/project";
import { EditInJotdown } from "./EditInJotdown";

/**
 * The site's docs shell around a page: its search, its sidebar of every page, and its logo.
 *
 * The foot of the sidebar offers the page in the Jotdown app when the project
 * lives on GitHub.
 *
 * @example <SiteShell><Page /></SiteShell>
 */
export async function SiteShell({ children }: { children: ReactNode }) {
  const project = publication();
  const source = await publicationSource();
  const tree = source.getPageTree();
  const github = githubProject(project.config.repository);

  return (
    <>
      <PublishSearchSections base={project.assetBase} sections={searchSections(source)} />
      <DocsShell
        tree={tree}
        tabs={sectionTabs(tree, project.base)}
        title={<ProjectTitle project={project} />}
        base={project.base}
        footer={
          <>
            {github && <EditInJotdown project={github} />}
            <SidebarFooter />
          </>
        }
      >
        {children}
      </DocsShell>
    </>
  );
}

/**
 * The `owner/repo` of a repository on GitHub, or null for one hosted anywhere else.
 *
 * @example githubProject("https://github.com/you/notes.git"); // "you/notes"
 */
function githubProject(repository: string | undefined) {
  return repository?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1] ?? null;
}
