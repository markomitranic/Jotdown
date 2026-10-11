import { localSession, type Session } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";
import { parseProjectId, type ProjectKey } from "@/lib/project-key";
import * as config from "@/server/settings/config";
import * as uploads from "@/server/settings/uploads";
import * as fonts from "@/server/settings/fonts";
import * as health from "@/server/settings/health";

type Handler = (request: Request, session: Session, key: ProjectKey) => Promise<Response> | Response;

const handlers: Record<string, Record<string, Handler>> = {
  config: { GET: config.readConfig, POST: config.saveConfig },
  history: { GET: config.listHistory },
  revision: { GET: config.readRevision },
  upload: { POST: uploads.upload },
  fonts: { GET: fonts.listFonts },
  font: { POST: fonts.installFont },
  health: { POST: (request, session, key) => health.checkHealth(request, key, session) },
};

type Context = { params: Promise<{ id: string; action: string }> };

/**
 * Runs one settings request against the project named in its URL, as the studio's editor.
 *
 * Like live-edit, the project comes from the URL rather than the project
 * cookie, so a save always lands in the project whose settings were open.
 */
async function handle(request: Request, context: Context) {
  const { id, action } = await context.params;
  const handler = handlers[action]?.[request.method];
  if (!handler) return new Response(null, { status: 405 });

  const key = parseProjectId(id);
  if (!key) return Response.json({ error: "That is not a project." }, { status: 404 });

  try {
    const session = await localSession();
    return await storage.editing(key, session, async () => handler(request, session, key));
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
