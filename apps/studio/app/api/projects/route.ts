import { cookies } from "next/headers";
import { z } from "zod";
import { LOOK_COOKIE, OPENED_COOKIE } from "@/server/projects/context";
import { localSession } from "@/server/auth/session";
import { ProjectUnavailable, storage } from "@/server/storage";
import { formatProjectKey, parseProjectKey } from "@/lib/project-key";
import { BrokenFile } from "@jotdown/core/lib/broken-file";

const COOKIE = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 } as const;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), key: z.string().min(1) }),
  z.object({ action: z.literal("brand"), key: z.string().min(1) }),
  z.object({ action: z.literal("download"), key: z.string().min(1) }),
]);

/** `GET /api/projects`: every project among the editor's recently pushed GitHub repositories. */
export async function GET() {
  const session = await localSession();

  try {
    const projects = await storage.listProjects(session);
    return Response.json({ projects, editor: session.editor });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "GitHub would not list your repositories." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

/**
 * `POST /api/projects`: checks a project can be opened, reads its look, or downloads it.
 *
 * Opening reads the branch once, so a key the editor cannot reach is refused
 * here with GitHub's reason rather than on the next page, and answers with the
 * branch and commit it found. The look is the project's title, theme stylesheet
 * and logo, so the loading screen can wear them before the pages arrive, and
 * the look is kept in a cookie so the reload onto the project wears it too.
 * Downloading copies the commit into the scratch folder, which the next page
 * view then finds already there, and says so in a cookie for a minute, so that
 * view's loading screen carries on from the last step.
 *
 * A project whose config is broken answers `broken` instead, so the switcher
 * goes straight to its address, where the page names the file and what is wrong.
 */
export async function POST(request: Request) {
  const session = await localSession();

  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Expected an open, brand or download action." }, { status: 400 });

  const key = parseProjectKey(input.data.key);
  if (!key) return Response.json({ error: "Write the project as owner/repo." }, { status: 400 });

  try {
    if (input.data.action === "brand") {
      const { stylesheet, ...look } = await storage.readBrand(key, session);
      (await cookies()).set(LOOK_COOKIE, JSON.stringify({ key: formatProjectKey(key), ...look }), COOKIE);
      return Response.json({ title: look.title, logo: look.logo, stylesheet });
    }

    if (input.data.action === "download") {
      await storage.openProject(key, session);
      (await cookies()).set(OPENED_COOKIE, formatProjectKey(key), { ...COOKIE, maxAge: 60 });
      return Response.json({ ok: true });
    }

    const { branch, head } = await storage.readHead(key, session);
    return Response.json({ ok: true, key: formatProjectKey(key), branch, head });
  } catch (error) {
    if (error instanceof BrokenFile) return Response.json({ broken: true, key: formatProjectKey(key) });
    return Response.json(
      { error: error instanceof Error ? error.message : "The project could not be opened." },
      { status: error instanceof ProjectUnavailable ? error.status : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
