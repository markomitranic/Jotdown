import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { DocsPage } from "@jotdown/core/components/docs/page";
import { PageContent } from "@jotdown/core/components/PageContent";
import { PageProblem, compilePage, pageBindings, type Source } from "@jotdown/core/components/CompiledPage";
import { slugInside } from "@jotdown/core/lib/project-base";
import { movedTo } from "@jotdown/core/lib/moved";
import { searchDocuments } from "@jotdown/core/server/search";
import { sourceProblems } from "@jotdown/core/server/content";
import { BrokenFile } from "@jotdown/core/lib/broken-file";
import { EDITABLE_FIELDS, getMDXComponents } from "@jotdown/editor/components/mdx";
import { withUnknownBlocks } from "@jotdown/core/components/blocks/UnknownBlock";
import { Article } from "@jotdown/editor/components/Article";
import { BrokenPage } from "@jotdown/editor/components/broken/BrokenPage";
import { ProjectProblems } from "@jotdown/editor/components/broken/ProjectProblems";
import { NoDocsYet } from "@/components/studio/setup/NoDocsYet";
import { NoPagesYet } from "@/components/studio/NoPagesYet";
import { Welcome, type BrokenConfig } from "@/components/studio/welcome/Welcome";
import { markdownUrl } from "@/lib/markdown-url";
import { getSource, requireSource } from "@/lib/source";
import { pageTarget } from "@/lib/page-target";
import { drawingOf } from "@/server/canvas/renderer";
import { currentProject, currentProjectKey } from "@/server/projects/context";
import { localSession } from "@/server/auth/session";
import { storage } from "@/server/storage";
import type { StudioProject } from "@/server/storage";

type Props = { params: Promise<{ slug?: string[] }> };

/**
 * One route for every page of the open project, and the welcome page at `/` when no project is open.
 *
 * The proxy takes the project's `/owner/repo` off the address, and
 * `slugInside` takes it off the slug where the platform handed it over anyway.
 */
export default async function Page({ params }: Props) {
  const opened = await openProject();
  const slug = slugInside("project" in opened ? opened.project.base : "", (await params).slug);

  if ("problem" in opened) {
    if (slug.length && opened.problem === null && !opened.broken) notFound();
    return <Welcome problem={opened.problem} broken={opened.broken} />;
  }
  const { project, source } = opened;
  const drawing = await drawingOf(project);
  if (drawing.canvas || drawing.renderer.mode === "dev") return null;

  const page = source.getPage(slug);
  if (!page && slug.length === 0) {
    if (!project.configured) return <NoDocsYet projectKey={project.key} branch={await defaultBranch()} />;
    if (source.getPages().length === 0) return <NoPagesYet projectKey={project.key} />;
  }
  if (!page) {
    const moved = movedTo(project, `/${slug.join("/")}`);
    if (moved) redirect(project.base + moved);
    notFound();
  }

  const target = pageTarget(project, page);
  const { path, githubUrl } = target;
  const problems = <ProjectProblems problems={sourceProblems(source)} fileUrl={project.fileUrl} current={path} />;

  if (page.data.problem) {
    return (
      <DocsPage>
        {problems}
        <BrokenPage
          title={page.data.title}
          path={path}
          problem={page.data.problem}
          text={await page.data.getText("raw")}
          githubUrl={githubUrl}
        />
      </DocsPage>
    );
  }

  const compiled = await compilePage(page);
  if ("problem" in compiled)
    return (
      <PageProblem title={page.data.title} problem={compiled.problem}>
        {problems}
      </PageProblem>
    );
  after(() => searchDocuments(source, (slugs) => markdownUrl(project.base, slugs)));

  const MDX = compiled.body;
  const text = await page.data.getText("raw");
  const fileText = page.data.generated ? null : text;
  const components = withUnknownBlocks(getMDXComponents(await pageBindings({ project, source, page })), text);

  return (
    <DocsPage toc={compiled.toc} full={page.data.full}>
      {problems}
      <Article source={fileText} target={target}>
        <PageContent
          title={page.data.title}
          description={page.data.description}
          icon={page.data.icon}
          generated={page.data.generated}
          editable={fileText !== null}
          fields={EDITABLE_FIELDS}
        >
          <MDX components={components} />
        </PageContent>
      </Article>
    </DocsPage>
  );
}

/**
 * The open project and its compiled pages, or why there are none to show.
 *
 * GitHub refusing the project and a config that will not read both end up
 * here, so the editor reads the reason on the page instead of an error screen.
 */
async function openProject(): Promise<
  { project: StudioProject; source: Source } | { problem: string | null; broken?: BrokenConfig }
> {
  try {
    const project = await currentProject();
    return project ? { project, source: await requireSource() } : { problem: null };
  } catch (error) {
    if (error instanceof BrokenFile) return { problem: null, broken: await brokenConfig(error) };
    return {
      problem: error instanceof Error ? error.message : "The project could not be opened.",
    };
  }
}

/**
 * A project file the project cannot open without, with where it is on GitHub for a project that lives there.
 *
 * @example await brokenConfig(error); // { projectKey: "you/site", file: ".jotdown/config.json", problem: "…", githubUrl: "https://github.com/you/site/blob/HEAD/.jotdown/config.json" }
 */
async function brokenConfig({ file, problem }: BrokenFile) {
  const key = await currentProjectKey();
  const projectKey = key ? `${key.owner}/${key.repo}` : "This project";
  const githubUrl =
    key && key.owner.toLowerCase() !== "local" ? `https://github.com/${key.owner}/${key.repo}/blob/HEAD/${file}` : "";
  return { projectKey, file, problem, githubUrl };
}

/**
 * The branch a project is read from, for a project with no docs yet to name.
 *
 * @example await defaultBranch(); // "main"
 */
async function defaultBranch() {
  const key = await currentProjectKey();
  if (!key) return "the default branch";
  return (await storage.readHead(key, await localSession()).catch(() => null))?.branch ?? "the default branch";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await currentProject().catch(() => null);
  const page = (await getSource().catch(() => null))?.getPage(slugInside(project?.base ?? "", (await params).slug));
  return page ? { title: page.data.title, description: page.data.description } : {};
}

export const dynamic = "force-dynamic";
