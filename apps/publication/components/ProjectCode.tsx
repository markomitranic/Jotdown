import type { ComponentType, ReactNode } from "react";
import { blocksOf, KitProvider, type LayoutProps } from "@jotdown/kit";
import * as project from "@project";
import { pageList } from "@jotdown/core/lib/page-list";
import FigureStage from "@jotdown/core/components/blocks/FigureStage";
import type { Source, SourcePage } from "@jotdown/core/components/CompiledPage";
import type { publication } from "@/server/project";

/**
 * The project's own code as the site draws it: its blocks, its layouts, and what they are told about the page.
 *
 * All of it comes from the project's `.jotdown/components` and
 * `.jotdown/layouts`, copied in before the build, and a project with neither
 * has none of it to pay for.
 */

/** The project's blocks, by the names its pages write them with. */
export const projectBlocks = blocksOf(project);

const ownLayouts: Record<string, ComponentType<LayoutProps>> = project.layouts;

/** Whether the project brings any code of its own, which is all the kit's page data is for. */
const hasCode = Object.keys(projectBlocks).length > 0 || Object.keys(ownLayouts).length > 0;

type Project = ReturnType<typeof publication>;

/**
 * The page, its site and its pages, handed to the project's blocks and layouts, when the project has any.
 *
 * @example <ProjectKit project={project} source={source} page={page}><MDX /></ProjectKit>
 */
export function ProjectKit({
  children,
  ...kit
}: {
  project: Project;
  source: Source;
  page: SourcePage;
  children: ReactNode;
}) {
  if (!hasCode) return children;
  return <KitProvider {...kitData(kit)}>{children}</KitProvider>;
}

/**
 * The page and its site as a project's blocks and layouts read them.
 *
 * @example kitData({ project, source, page }).page.title; // "Setup"
 */
export function kitData({ project, source, page }: { project: Project; source: Source; page: SourcePage }) {
  const { title, description, icon, full, layout } = page.data;
  const { config } = project;

  return {
    page: { title, description, url: page.url, data: { icon, full, layout } },
    site: { title: config.title, description: config.description, base: project.base, url: config.url },
    pages: pageList(source.getPageTree()),
  };
}

/**
 * A page's content in a layout other than the docs: the bare page, or one of the project's own.
 *
 * Either opens its pictures and figures on the fullscreen stage, as the docs do.
 * A page naming a layout nobody has stops the build, saying which.
 *
 * @example <OwnLayout name="landing" project={project} source={source} page={page}>{body}</OwnLayout>
 */
export function OwnLayout({
  name,
  children,
  ...kit
}: {
  name: string;
  project: Project;
  source: Source;
  page: SourcePage;
  children: ReactNode;
}) {
  if (name === "blank")
    return (
      <main className="prose max-w-none">
        {children}
        <FigureStage />
      </main>
    );

  const Layout = ownLayouts[name];
  if (!Layout)
    throw new Error(
      `${kit.page.path} asks for the layout "${name}", which is neither docs, blank nor one of .jotdown/layouts.`,
    );

  const { page, site } = kitData(kit);
  return (
    <>
      <Layout page={page} site={site}>
        {children}
      </Layout>
      <FigureStage />
    </>
  );
}
