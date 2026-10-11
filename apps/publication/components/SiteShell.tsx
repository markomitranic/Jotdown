import type { ReactNode } from "react";
import { DocsShell, SidebarFooter } from "@jotdown/core/components/DocsShell";
import { ProjectTitle } from "@jotdown/core/components/ProjectLook";
import { PublishSearchSections } from "@jotdown/core/components/search/ProjectSearch";
import { searchSections } from "@jotdown/core/server/search";
import { sectionTabs } from "@jotdown/core/lib/sections";
import { publication, publicationSource } from "@/server/project";

/**
 * The site's docs shell around a page: its search, its sidebar of every page, and its logo.
 *
 * @example <SiteShell><Page /></SiteShell>
 */
export async function SiteShell({ children }: { children: ReactNode }) {
  const project = publication();
  const source = await publicationSource();
  const tree = source.getPageTree();

  return (
    <>
      <PublishSearchSections base={project.assetBase} sections={searchSections(source)} />
      <DocsShell
        tree={tree}
        tabs={sectionTabs(tree, project.base)}
        title={<ProjectTitle project={project} />}
        base={project.base}
        footer={<SidebarFooter />}
      >
        {children}
      </DocsShell>
    </>
  );
}
