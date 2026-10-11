import { getSource } from "@/lib/source";
import { markdownUrl } from "@/lib/markdown-url";
import { currentProject } from "@/server/projects/context";
import { searchDocuments, searchSections } from "@jotdown/core/server/search";

type Params = { params: Promise<{ key: string; id?: string[] }> };

/**
 * One section's search text, for the browser to index: `/api/search/section/<key>/manual`.
 *
 * Asked for by its current key, the answer never changes, so the browser keeps
 * it for good, and only this browser: the text is as private as the repository.
 * Asked for by an old key, it answers with the current text and keeps nothing.
 */
export async function GET(_request: Request, { params }: Params) {
  const { key, id = [] } = await params;
  const project = await currentProject();
  const source = await getSource();
  const section = source && searchSections(source).find((each) => each.id === id.join("/"));
  if (!project || !source || !section) return Response.json([], { status: 404 });

  const documents = await searchDocuments(source, (slugs) => markdownUrl(project.base, slugs), section.id);
  return Response.json(documents, {
    headers: { "cache-control": key === section.key ? "private, max-age=31536000, immutable" : "private, no-store" },
  });
}

export const dynamic = "force-dynamic";
