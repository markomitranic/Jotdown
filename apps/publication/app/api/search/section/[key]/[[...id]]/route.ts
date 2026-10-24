import { notFound } from "next/navigation";
import { searchDocuments, searchSections } from "@jotdown/core/server/search";
import { markdownUrl } from "@/lib/markdown-url";
import { publicationSource } from "@/server/project";

type Params = { params: Promise<{ key: string; id?: string[] }> };

/**
 * One section's search text, for the browser to index: `/api/search/section/<key>/manual`.
 *
 * Written at build time under the key of the text it holds, so the browser
 * keeps it for good and a new build is new addresses.
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

/** Every section's text, written at build time. */
export async function generateStaticParams() {
  return searchSections(await publicationSource()).map(({ key, id }) => ({ key, id: id ? id.split("/") : [] }));
}

export const dynamic = "force-static";
export const dynamicParams = false;
