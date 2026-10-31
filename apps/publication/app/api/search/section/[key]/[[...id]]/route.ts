import { notFound } from "next/navigation";
import { searchDocuments, searchSections } from "@jotdown/core/server/search";
import { markdownUrl } from "@/lib/markdown-url";
import { publication, publicationSource } from "@/server/project";

type Params = { params: Promise<{ key: string; id?: string[] }> };

/**
 * One section's search text, for the browser to index: `/api/search/section/<key>/manual`.
 *
 * Served under the key of the text it holds, so the browser keeps it for
 * good and a new build is new addresses.
 */
export async function GET(_request: Request, { params }: Params) {
  const { key, id = [] } = await params;
  const source = await publicationSource();
  const section = searchSections(source).find((each) => each.key === key && each.id === id.join("/"));
  if (!section) notFound();

  return Response.json(await searchDocuments(source, markdownUrl, section.id), {
    headers: { "cache-control": "private, max-age=31536000, immutable" },
  });
}

/** Every section's text when the config asks for it at build time, or none, so each is written on its first visit. */
export async function generateStaticParams() {
  if (!publication().config.prerender) return [];
  return searchSections(await publicationSource()).map(({ key, id }) => ({ key, id: id ? id.split("/") : [] }));
}

export const dynamic = "force-static";
