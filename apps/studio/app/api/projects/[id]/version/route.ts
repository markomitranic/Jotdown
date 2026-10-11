import { localSession } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";
import { parseProjectId } from "@/lib/project-key";

/**
 * The version a project is at, so an open page can notice it moving.
 *
 * `GET /api/projects/<id>/version` answering `{ version: "<sha>" }`.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const key = parseProjectId((await context.params).id);
  if (!key) return Response.json({ error: "Not available." }, { status: 404 });

  try {
    const { head } = await storage.readHead(key, await localSession());
    return Response.json({ version: head }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: "Could not read the branch." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
