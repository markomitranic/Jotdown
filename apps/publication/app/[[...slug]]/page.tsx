import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsPage, DocsTitle } from "@jotdown/core/components/docs/page";
import { PageContent } from "@jotdown/core/components/PageContent";
import { ReadingArticle } from "@jotdown/core/components/ReadingArticle";
import { getMDXComponents } from "@jotdown/core/components/mdx";
import { compilePage, pageBindings } from "@jotdown/core/components/CompiledPage";
import type { ProjectConfig } from "@jotdown/core/server/config";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { markdownUrl } from "@/lib/markdown-url";
import { publication, publicationSource } from "@/server/project";
import { contentRepository } from "@/repository";
import { movedPages } from "@/moved";
import { SiteShell } from "@/components/SiteShell";
import { OwnLayout, ProjectKit, projectBlocks } from "@/components/ProjectCode";

type Props = { params: Promise<{ slug?: string[] }> };

/**
 * Every page of the publication, rendered once at build time, in the layout it asks for.
 *
 * A page is drawn in the docs shell unless its front matter, or the config,
 * names another layout. The project's own blocks win over the framework's by
 * name. An address no page lives at is a 404. One a page moved away from, as
 * `docs/moved.json` records, is a page of its own that forwards the reader to
 * where it lives now. A page that does not compile stops the build, so a
 * reader never gets one that says so.
 */
export default async function Page({ params }: Props) {
  const project = publication();
  const source = await publicationSource();
  const slug = (await params).slug ?? [];
  const page = source.getPage(slug);
  if (!page) {
    const moved = movedTo(slug);
    if (moved) return <MovedPage to={moved} />;
    notFound();
  }

  const compiled = await compilePage(page);
  if ("problem" in compiled) throw new Error(compiled.problem);
  const MDX = compiled.body;
  const path = `${DOCS_ROOT}/${page.path}`;
  const components = { ...getMDXComponents(await pageBindings({ project, source, page })), ...projectBlocks };
  const layout = page.data.layout ?? project.config.layout;
  const kit = { project, source, page };

  if (layout !== "docs")
    return (
      <ProjectKit {...kit}>
        <OwnLayout name={layout} {...kit}>
          <MDX components={components} />
        </OwnLayout>
      </ProjectKit>
    );

  return (
    <SiteShell>
      <ProjectKit {...kit}>
        <DocsPage toc={compiled.toc} full={page.data.full}>
          <ReadingArticle
            title={page.data.title}
            markdownUrl={`${project.assetBase}${markdownUrl(page.slugs)}`}
            githubUrl={githubBlobUrl(project.config, path)}
          >
            <PageContent
              title={page.data.title}
              description={page.data.description}
              icon={page.data.icon}
              generated={page.data.generated}
            >
              <MDX components={components} />
            </PageContent>
          </ReadingArticle>
        </DocsPage>
      </ProjectKit>
    </SiteShell>
  );
}

/**
 * Where a page's file sits on GitHub by the project's own config, or empty when it names no repository.
 *
 * @example githubBlobUrl(config, "docs/index.mdx"); // "https://github.com/you/notes/blob/main/docs/index.mdx"
 */
function githubBlobUrl({ repository, branch, content }: ProjectConfig, path: string) {
  return repository ? `${repository}/blob/${branch ?? "main"}/${content ? `${content}/` : ""}${path}` : "";
}

/**
 * Where a page that moved away from these segments lives now, or null.
 *
 * @example movedTo(["guides", "old"]); // "/guides/new"
 */
function movedTo(slug: string[]) {
  const wanted = slug.join("/");
  return (
    movedPages(contentRepository(), publication().assetBase).find((move) => move.slugs.join("/") === wanted)?.to ?? null
  );
}

/**
 * The page left at an old address: it forwards the reader at once, and says where to in case it cannot.
 *
 * @example <MovedPage to="/guides/new" />
 */
function MovedPage({ to }: { to: string }) {
  return (
    <SiteShell>
      <DocsPage breadcrumb={false} footer={false} tableOfContent={false}>
        <meta httpEquiv="refresh" content={`0; url=${to}`} />
        <link rel="canonical" href={to} />
        <DocsTitle>This page has moved</DocsTitle>
        <DocsBody>
          <p>
            It lives at <a href={to}>{to}</a> now.
          </p>
        </DocsBody>
      </DocsPage>
    </SiteShell>
  );
}

/**
 * Every page's address, and every address a page moved away from, so each one is written at build time.
 *
 * @example await generateStaticParams(); // [{ slug: [] }, { slug: ["manual", "sections"] }, …]
 */
export async function generateStaticParams() {
  const moved = movedPages(contentRepository(), publication().assetBase).map((move) => ({ slug: move.slugs }));
  return [...(await publicationSource()).generateParams(), ...moved];
}

/**
 * The page's title and description, for the tab and for link previews.
 *
 * @example await generateMetadata({ params }); // { title: "Sections", description: "How the switcher works" }
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug ?? [];
  const page = (await publicationSource()).getPage(slug);
  if (page) return { title: page.data.title, description: page.data.description };
  return movedTo(slug) ? { title: "This page has moved" } : {};
}

export const dynamic = "error";
export const dynamicParams = false;
