import { localSession } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";
import { parseProjectId } from "@/lib/project-key";
import * as source from "@/server/live-edit/source";
import * as save from "@/server/live-edit/save";
import * as asset from "@/server/live-edit/asset";
import * as structure from "@/server/live-edit/structure";
import * as history from "@/server/live-edit/history";
import * as revision from "@/server/live-edit/revision";

const handlers: Record<string, Record<string, (request: Request) => Promise<Response> | Response>> = {
  source: { GET: source.GET },
  save: { POST: save.POST },
  asset: { POST: asset.POST },
  structure: { POST: structure.POST },
  history: { GET: history.GET },
  revision: { GET: revision.GET },
};

type Context = { params: Promise<{ id: string; action: string }> };

/**
 * Runs one editing request against the project named in its URL, as the studio's editor.
 *
 * The project comes from the URL the page handed the editor rather than from
 * the project cookie, so switching projects in another tab cannot redirect a
 * save that is already on its way.
 */
async function handle(request: Request, context: Context) {
  const { id, action } = await context.params;
  const handler = handlers[action]?.[request.method];
  if (!handler) return new Response(null, { status: 405 });

  const key = parseProjectId(id);
  if (!key) return Response.json({ error: "That is not a project." }, { status: 404 });

  try {
    return await storage.editing(key, await localSession(), async () => handler(request));
  } catch (error) {
    const status = error instanceof ProjectUnavailable ? error.status : 502;
    return Response.json(
      { error: error instanceof Error ? error.message : "The project could not be reached." },
      { status },
    );
  }
}

export { handle as GET, handle as POST };

export const maxDuration = 30;
export const dynamic = "force-dynamic";
