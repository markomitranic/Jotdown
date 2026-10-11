import { z } from "zod";
import { checkSignIn, startSignIn } from "@/server/auth/device";
import { forgetToken, githubToken, tokenSource } from "@/server/auth/token";
import { graphql } from "@/server/storage/github/projects";

const actionSchema = z.object({ action: z.enum(["start", "check"]) });

/** The GitHub account the studio is signed in as, as `GET /api/auth` answers. */
export type Account = { login: string; name: string | null; avatarUrl: string };

/**
 * `GET /api/auth`: who the studio is signed in to GitHub as, and where its token came from.
 *
 * A token GitHub no longer accepts answers no account and says so, so the page
 * can offer to sign in again.
 */
export async function GET() {
  const source = await tokenSource();
  if (!source) return Response.json({ account: null, source });

  try {
    const { viewer } = await graphql<{ viewer: Account }>(
      await githubToken(),
      "{ viewer { login name avatarUrl(size: 40) } }",
      {},
    );
    return Response.json({ account: viewer, source });
  } catch (error) {
    return Response.json({
      account: null,
      source,
      error: error instanceof Error ? error.message : "GitHub did not accept the token.",
    });
  }
}

/** `POST /api/auth`: starts a device-flow sign-in, or checks whether the code was entered. */
export async function POST(request: Request) {
  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Expected a start or check action." }, { status: 400 });

  try {
    if (input.data.action === "start") return Response.json(await startSignIn());
    return Response.json({ state: await checkSignIn() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "GitHub could not be reached." },
      { status: 502 },
    );
  }
}

/** `DELETE /api/auth`: signs the studio out of GitHub by forgetting its token. */
export async function DELETE() {
  await forgetToken();
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
