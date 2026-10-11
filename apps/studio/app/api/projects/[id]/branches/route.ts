import { z } from "zod";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable } from "@/server/storage";
import { readBranches, switchBranch } from "@/server/projects/branches";
import { parseProjectId } from "@/lib/project-key";

type Context = { params: Promise<{ id: string }> };

/** `GET /api/projects/<id>/branches`: the branch the project is on, its home branch, and every branch it has. */
export async function GET(_request: Request, context: Context) {
  const key = parseProjectId((await context.params).id);
  if (!key) return Response.json({ error: "Not available." }, { status: 404 });

  try {
    return Response.json(await readBranches(key, await localSession()), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failed(error, "The branches could not be read.");
  }
}

const choiceSchema = z.object({ branch: z.string().min(1) });

/** `POST /api/projects/<id>/branches` with `{ branch }`: moves the project to that branch. */
export async function POST(request: Request, context: Context) {
  const key = parseProjectId((await context.params).id);
  const input = choiceSchema.safeParse(await request.json().catch(() => null));
  if (!key || !input.success) return Response.json({ error: "Name the branch." }, { status: 400 });

  try {
    await switchBranch(key, await localSession(), input.data.branch);
    return Response.json({ ok: true });
  } catch (error) {
    return failed(error, "The branch could not be switched.");
  }
}

function failed(error: unknown, fallback: string) {
  if (error instanceof ProjectUnavailable) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: fallback }, { status: 502 });
}

export const dynamic = "force-dynamic";
