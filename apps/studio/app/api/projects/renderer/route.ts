import { z } from "zod";
import { keepRenderer } from "@/server/storage/favorites";
import { parseProjectKey } from "@/lib/project-key";

const choiceSchema = z.object({
  key: z.string().min(1),
  renderer: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("site") }),
    z.object({ mode: z.literal("custom"), url: z.url() }),
    z.object({ mode: z.literal("dev") }),
    z.object({ mode: z.literal("skinny") }),
  ]),
});

/** `POST /api/projects/renderer` with `{ key, renderer }`: remembers how a project is drawn from now on. */
export async function POST(request: Request) {
  const input = choiceSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !parseProjectKey(input.data.key))
    return Response.json({ error: "Name the project and how to draw it." }, { status: 400 });

  await keepRenderer(input.data.key, input.data.renderer);
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
