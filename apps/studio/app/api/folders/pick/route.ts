import { env } from "@/env";
import { projectTitle } from "@/server/storage/disk/folders";

/**
 * `POST /api/folders/pick`: asks the desktop app for its native folder picker, answering the folder chosen.
 *
 * Answers `{ path: null }` when the picker was cancelled, and the folder's
 * project title when it holds a `.jotdown/config.json`. Outside the app there
 * is no picker, and the studio's own folder browser stands in.
 */
export async function POST() {
  if (!env.JOTDOWN_BRIDGE)
    return Response.json({ error: "Only the Jotdown app has a folder picker." }, { status: 404 });

  const answer = await fetch(`${env.JOTDOWN_BRIDGE}/pick-folder`, { method: "POST" }).catch(() => null);
  if (!answer?.ok) return Response.json({ error: "The folder picker did not open." }, { status: 502 });

  const { path }: { path: string | null } = await answer.json();
  return Response.json({ path, title: path ? projectTitle(path) : null });
}

export const dynamic = "force-dynamic";
