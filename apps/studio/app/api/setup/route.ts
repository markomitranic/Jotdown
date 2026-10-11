import { z } from "zod";
import { setupAnswersSchema, setupTargetSchema } from "@/lib/setup";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable } from "@/server/storage";
import { SetupRefused, inspect, inspectContent, planFor, setUp } from "@/server/setup";
import { listRepositories } from "@/server/setup/github";

const NO_STORE = { "cache-control": "no-store" };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("inspect"), target: setupTargetSchema }),
  z.object({
    action: z.literal("content"),
    target: setupTargetSchema,
    content: setupAnswersSchema.shape.content,
  }),
  z.object({ action: z.literal("plan"), answers: setupAnswersSchema }),
  z.object({ action: z.literal("create"), answers: setupAnswersSchema }),
]);

/** `GET /api/setup`: every GitHub repository the editor can reach, for the wizard's first step. */
export async function GET() {
  const session = await localSession();
  if (!session.token) return Response.json({ repositories: [] }, { headers: NO_STORE });

  try {
    return Response.json({ repositories: await listRepositories(session) }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "GitHub would not list your repositories.");
  }
}

/**
 * `POST /api/setup`: looks at a target or at the content folder chosen in it, plans a setup without writing, or sets the project up.
 *
 * Planning and creating read the target again, so what Create writes is what
 * the target holds at that moment, whatever the review step showed.
 */
export async function POST(request: Request) {
  const session = await localSession();

  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Expected an inspect, plan or create action." },
      { status: 400 },
    );

  try {
    const { data } = input;
    if (data.action === "inspect") return Response.json(await inspect(data.target, session), { headers: NO_STORE });
    if (data.action === "content")
      return Response.json(await inspectContent(data.target, data.content, session), { headers: NO_STORE });
    if (data.action === "plan") return Response.json(await planFor(data.answers, session), { headers: NO_STORE });
    return Response.json(await setUp(data.answers, session), { headers: NO_STORE });
  } catch (error) {
    return failure(error, "The project could not be set up.");
  }
}

function failure(error: unknown, fallback: string) {
  const status = error instanceof SetupRefused || error instanceof ProjectUnavailable ? error.status : 502;
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status, headers: NO_STORE });
}

export const dynamic = "force-dynamic";
