import type { ComponentProps, ReactNode } from "react";
import Link from "fumadocs-core/link";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "@jotdown/core/components/docs/page";
import { Card } from "@jotdown/core/components/blocks/Cards";
import DocImage from "@jotdown/core/components/blocks/DocImage";
import { DocCardList } from "@jotdown/core/components/blocks/DocCardList";
import { underBase } from "@jotdown/core/lib/project-base";
import type { projectSource } from "@jotdown/core/server/content";
import type { Project } from "@jotdown/core/server/project";

/** A project's compiled pages, as the routes look them up. */
export type Source = Awaited<ReturnType<typeof projectSource>>;

/** One page of a project's source. */
export type SourcePage = NonNullable<ReturnType<Source["getPage"]>>;

/**
 * One page compiled, or why it would not compile.
 *
 * A page that fails the content check or has broken MDX says so where it
 * stands, and the sidebar around it keeps working.
 *
 * @example const compiled = await compilePage(page); if ("problem" in compiled) …
 */
export async function compilePage(page: SourcePage) {
  try {
    return await page.data.load();
  } catch (error) {
    return { problem: error instanceof Error ? error.message : "The page could not be compiled." };
  }
}

/**
 * The page's title and what stopped it compiling, in place of its content, under any notice the app puts above it.
 *
 * @example <PageProblem title="Setup" problem="docs/setup.mdx: imports are not allowed" />
 */
export function PageProblem({ title, problem, children }: { title: string; problem: string; children?: ReactNode }) {
  return (
    <DocsPage>
      {children}
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>This page could not be compiled. Check its front matter and MDX, then reload.</DocsDescription>
      <DocsBody>
        <p role="alert" className="font-mono text-destructive text-sm">
          {problem}
        </p>
      </DocsBody>
    </DocsPage>
  );
}

/**
 * The page's own components, bound to where it sits: links under the project's base and the section grid.
 *
 * Handed to the app's component map, which lets them win over its defaults.
 *
 * @example <MDX components={getMDXComponents(await pageBindings({ project, source, page }))} />
 */
export async function pageBindings({ project, source, page }: { project: Project; source: Source; page: SourcePage }) {
  const tree = source.getPageTree();

  return {
    a: underBase(project, "href", relativeLink(source, page)),
    Card: underBase(project, "href", Card),
    img: underBase(project, "src", DocImage),
    DocCardList: (props: { title?: string }) => (
      <DocCardList tree={tree} url={page.url} root={page.slugs.length === 0} {...props} />
    ),
  };
}

/**
 * The page's links, with a link to another file's path turned into that page's address.
 *
 * @example relativeLink(source, page)({ href: "./install.mdx" }); // a link to "/guides/install"
 */
function relativeLink(source: Source, page: SourcePage) {
  return function RelativeLink({ href, ...props }: ComponentProps<typeof Link>) {
    return <Link href={href ? source.resolveHref(href, page) : href} {...props} />;
  };
}
