import { parseProjectKey } from "@/lib/project-key";
import { canvasLoad } from "@/server/canvas/load";
import { ProjectUnavailable } from "@/server/storage";

/**
 * `GET /api/canvas?key=you/notes&slug=guides/setup`: one page of a project, as the canvas framing it draws it.
 *
 * Answers 404 for an address no page lives at, and the storage's own status
 * when the project cannot be opened.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const key = parseProjectKey(query.get("key") ?? "");
  if (!key) return Response.json({ error: "Name the project as owner/repo." }, { status: 400 });

  const slug = (query.get("slug") ?? "").split("/").filter(Boolean);
  try {
    const load = await canvasLoad(key, slug);
    return load
      ? Response.json(load, { headers: { "cache-control": "no-store" } })
      : Response.json({ error: "No page lives at this address." }, { status: 404 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The project could not be opened." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
