import { notFound } from "next/navigation";
import { twinPage, twinPath } from "@/lib/markdown-url";
import { publicationSource } from "@/server/project";

/**
 * The markdown source of one page, as text, at `/markdown/<page>.md`, with the landing page at `__root.md`.
 *
 * This is what Copy markdown in the page menu copies and what `/llms.txt`
 * links, so it serves the file as written, front matter and all. Served as
 * `text/plain` on purpose: a browser handed `text/markdown` downloads it
 * instead of showing it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const slugs = twinPage((await params).slug);
  const page = slugs && (await publicationSource()).getPage(slugs);
  if (!page) notFound();

  return new Response(await page.data.getText("raw"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** Every page's twin, written at build time. */
export async function generateStaticParams() {
  return (await publicationSource()).generateParams().map(({ slug }) => ({ slug: twinPath(slug ?? []) }));
}

export const dynamic = "force-static";
export const dynamicParams = false;
