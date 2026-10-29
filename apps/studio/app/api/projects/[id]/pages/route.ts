import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { projectSource } from "@jotdown/core/server/content";
import { pageOutline } from "@/lib/page-outline";
import { parseProjectId } from "@/lib/project-key";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";

/**
 * Every page of a project as the page picker lists it, whatever renderer draws the project.
 *
 * `GET /api/projects/<id>/pages` answering `{ pages: PageOutline[] }`, each page
 * with the file behind it unless code writes it. Read
 * fresh each time, so a page added from a site's canvas is there the next time
 * the picker opens.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const key = parseProjectId((await context.params).id);
  if (!key) return Response.json({ error: "Not available." }, { status: 404 });

  try {
    const project = await storage.openProject(key, await localSession());
    const source = await projectSource(project);
    const files = Object.fromEntries(
      source
        .getPages()
        .filter((page) => !page.data.generated)
        .map((page) => [page.url, `${DOCS_ROOT}/${page.path}`]),
    );
    const pages = pageOutline(source.getPageTree(), files);
    return Response.json({ pages }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: "Could not read the project's pages." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
