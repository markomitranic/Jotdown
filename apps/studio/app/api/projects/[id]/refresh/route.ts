import { env } from "@/env";
import { checkForUpdate } from "@/server/updates";
import { forgetProject } from "@/server/storage/github/projects";
import { parseProjectId } from "@/lib/project-key";

/**
 * `POST /api/projects/<id>/refresh`: forgets what the studio settled about the project, and looks for a newer Jotdown.
 *
 * Answers `{ checked, update }`: whether there was an app to ask, and the
 * Jotdown update waiting for a restart afterwards, or null.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const key = parseProjectId((await context.params).id);
  if (!key) return Response.json({ error: "Not available." }, { status: 404 });

  forgetProject(key);
  return Response.json({ checked: Boolean(env.JOTDOWN_BRIDGE), update: await checkForUpdate() });
}

export const dynamic = "force-dynamic";
