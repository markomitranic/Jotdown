import { z } from "zod";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable } from "@/server/storage";
import { openInEditor } from "@/server/projects/editor";
import { parseProjectId } from "@/lib/project-key";

const pageSchema = z.object({ slug: z.array(z.string()) });

/** `POST /api/projects/<id>/open-in-editor` with `{ slug }`: opens the folder in VS Code, at the page the slug names. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const key = parseProjectId((await context.params).id);
  const input = pageSchema.safeParse(await request.json().catch(() => null));
  if (!key || !input.success) return Response.json({ error: "Name the page." }, { status: 400 });

  try {
    await openInEditor(key, await localSession(), input.data.slug);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProjectUnavailable) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "VS Code could not be opened." }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
