import { projectSource } from "@jotdown/core/server/content";
import { pageOutline } from "@/lib/page-outline";
import { parseProjectId } from "@/lib/project-key";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";

/**
 * Every page of a project as the page picker lists it, whatever renderer draws the project.
 *
 * `GET /api/projects/<id>/pages` answering `{ pages: PageOutline[] }`. Read
 * fresh each time, so a page added from a site's canvas is there the next time
 * the picker opens.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const key = parseProjectId((await context.params).id);
  if (!key) return Response.json({ error: "Not available." }, { status: 404 });

  try {
    const project = await storage.openProject(key, await localSession());
    const pages = pageOutline((await projectSource(project)).getPageTree());
    return Response.json({ pages }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: "Could not read the project's pages." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
