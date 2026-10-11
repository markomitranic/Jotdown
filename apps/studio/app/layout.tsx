import "@jotdown/core/css/global.css";
import { env } from "@/env";
import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import type * as PageTree from "fumadocs-core/page-tree";
import { LiveEditRoot } from "@jotdown/editor/components/LiveEditRoot";
import { SiteRoot } from "@jotdown/core/components/SiteRoot";
import { StudioShell } from "@/components/StudioShell";
import { TitleBarColour } from "@/components/TitleBarColour";
import { WindowTitleBar } from "@/components/WindowTitleBar";
import { PublishSearchSections } from "@jotdown/core/components/search/ProjectSearch";
import { StartingUp } from "@/components/studio/OpeningProject";
import { SignInDialog } from "@/components/studio/account/SignInDialog";
import { OutsideLinks } from "@/components/OutsideLinks";
import { WorkspaceProvider } from "@/components/studio/Workspace";
import { CanvasWorkspace } from "@/components/studio/canvas/CanvasWorkspace";
import { drawingOf, type Drawing } from "@/server/canvas/renderer";
import { liveEditConfig } from "@/lib/live-edit/config";
import { sectionTabs } from "@jotdown/core/lib/sections";
import { ProjectStyles, ProjectTitle, projectLogo } from "@jotdown/core/components/ProjectLook";
import { getSource, requireSource } from "@/lib/source";
import { currentProject, currentProjectKey, rememberedLook } from "@/server/projects/context";
import { localSession } from "@/server/auth/session";
import { searchSections, type SearchSection } from "@jotdown/core/server/search";
import type { StudioProject } from "@/server/storage";

/**
 * The open project's name in the window title, and the studio's own icon.
 */
export async function generateMetadata(): Promise<Metadata> {
  const project = await currentProject().catch(() => null);
  const title = project?.config.title ?? "Jotdown";
  return {
    title: { default: title, template: `%s | ${title}` },
    description: project?.config.description,
    robots: { index: false, follow: false },
    icons: { icon: "/favicon.png", apple: "/apple-icon.png" },
  };
}

/**
 * A fixed-scale viewport, so the site behaves as an app rather than a page.
 *
 * Capping the scale at one also stops iOS zooming into a focused input whose
 * text is under 16px, which would push fixed dialogs off the screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * The one layout: the page's frame, sent at once, with the open project streamed into it.
 *
 * Opening a project can mean copying a commit out of GitHub, so the studio
 * answers straight away with a screen naming the project it is opening, in the
 * colours the switcher last tried on for it, and swaps in the docs shell once
 * the project's tree is ready.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  const opening = await currentProjectKey();
  const look = opening ? await rememberedLook(opening) : null;

  return (
    <html lang="en" data-app={env.JOTDOWN_APP ? "" : undefined} suppressHydrationWarning>
      <body>
        <SiteRoot>
          <TitleBarColour />
          <WindowTitleBar />
          <Suspense fallback={opening && <StartingUp parts={opening} look={look} />}>
            <Workspace>{children}</Workspace>
          </Suspense>
          <SignInDialog />
          {env.JOTDOWN_APP && <OutsideLinks />}
        </SiteRoot>
      </body>
    </html>
  );
}

/**
 * The open project's docs shell, or the page on its own when no project compiled.
 *
 * With no project open, one GitHub would not hand over, or one that fails to
 * compile, the page renders on its own, says why, and offers another.
 *
 * The tree is named after the commit it was read from, because the docs layout
 * keeps a tree for as long as its root's `$id` stays the same, and a refresh
 * after a commit would otherwise keep drawing the sidebar from before it.
 */
async function Workspace({ children }: { children: ReactNode }) {
  const project = await currentProject().catch(() => null);
  const drawing = project ? await drawingOf(project) : null;
  if (project && (drawing?.canvas || drawing?.renderer.mode === "dev"))
    return <CanvasProject project={project} drawing={drawing} />;
  const source = project ? await getSource().catch(() => null) : null;

  return (
    <>
      {project && <ProjectStyles project={project} />}
      {project && source ? (
        <ProjectShell
          project={project}
          drawing={drawing}
          tree={{ ...source.getPageTree(), $id: project.version }}
          sections={searchSections(source)}
        >
          {children}
        </ProjectShell>
      ) : (
        children
      )}
    </>
  );
}

type ShellProps = {
  project: StudioProject;
  drawing: Drawing | null;
  tree: PageTree.Root;
  sections: SearchSection[];
  children: ReactNode;
};

/**
 * The docs shell around a project that compiled: its sidebar, section tabs, logo and editor.
 *
 * The logo at the top of the sidebar is the workspace menu that switches projects.
 */
async function ProjectShell({ project, drawing, tree, sections, children }: ShellProps) {
  const session = await localSession();

  return (
    <LiveEditRoot config={liveEditConfig(project, session, await requireSource())}>
      <PublishSearchSections base={project.base} sections={sections} />
      <WorkspaceProvider
        workspace={{
          editor: session.editor,
          project: { id: project.id, key: project.key, title: project.config.title },
          logo: projectLogo(project),
          drawing: drawing ? drawingFor(drawing) : undefined,
        }}
      >
        <StudioShell
          tree={tree}
          tabs={sectionTabs(tree, project.base)}
          title={<ProjectTitle project={project} />}
          base={project.base}
        >
          {children}
        </StudioShell>
      </WorkspaceProvider>
    </LiveEditRoot>
  );
}

/**
 * A project its site draws: the studio's workspace around the site's canvas, with no shell of its own.
 *
 * @example <CanvasProject project={project} drawing={drawing} />
 */
async function CanvasProject({ project, drawing }: { project: StudioProject; drawing: Drawing }) {
  const session = await localSession();

  return (
    <WorkspaceProvider
      workspace={{
        editor: session.editor,
        project: { id: project.id, key: project.key, title: project.config.title },
        logo: projectLogo(project),
        drawing: drawingFor(drawing),
      }}
    >
      <CanvasWorkspace
        src={drawing.canvas}
        project={{
          key: project.key,
          base: project.base,
          title: project.config.title,
          repository: project.config.repository,
        }}
      />
    </WorkspaceProvider>
  );
}

/** What the renderer menu needs to know about how a project is drawn. */
function drawingFor({ renderer, siteUrl, folder }: Drawing) {
  return { mode: renderer.mode, siteUrl, customUrl: renderer.mode === "custom" ? renderer.url : null, folder };
}

export const dynamic = "force-dynamic";
