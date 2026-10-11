import { cookies } from "next/headers";
import { z } from "zod";
import { localSession } from "@/server/auth/session";
import { storage } from "@/server/storage";
import { forgetFavorite, JOTDOWN_DOCS, keepFavorite, readFavorites } from "@/server/storage/favorites";
import { PROJECT_COOKIE, parseProjectKey } from "@/lib/project-key";

const keepSchema = z.object({ key: z.string().min(1), title: z.string().min(1) });

/**
 * `GET /api/projects/bookmarks`: the favorites, as GitHub and the disk answer for each, and the one last opened.
 *
 * Jotdown's own manual comes first among the GitHub favorites, pinned. A
 * GitHub favorite GitHub will not show is listed locked, under the title it
 * was kept with. While nobody is signed in, each is listed unchecked under that title.
 */
export async function GET() {
  const session = await localSession();
  const pinned = JOTDOWN_DOCS.key.toLowerCase();
  const kept = (await readFavorites()).github.filter((favorite) => favorite.key.toLowerCase() !== pinned);
  const github = [JOTDOWN_DOCS, ...kept];
  const titles = new Map(github.map((favorite) => [favorite.key.toLowerCase(), favorite.title]));

  try {
    const answered = await storage.readBookmarks(
      session,
      github.flatMap((favorite) => parseProjectKey(favorite.key) ?? []),
    );
    const bookmarks = answered.map((bookmark) => ({
      ...bookmark,
      title:
        bookmark.locked || !session.token ? (titles.get(bookmark.key.toLowerCase()) ?? bookmark.title) : bookmark.title,
      pinned: bookmark.key.toLowerCase() === pinned || undefined,
    }));
    return Response.json({ bookmarks, selected: (await cookies()).get(PROJECT_COOKIE)?.value ?? null });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "GitHub would not read your bookmarks." },
      { status: 502 },
    );
  }
}

/** `POST /api/projects/bookmarks` with `{ key, title }`: keeps a GitHub project as a favorite. */
export async function POST(request: Request) {
  const input = keepSchema.safeParse(await request.json().catch(() => null));
  const key = input.success ? parseProjectKey(input.data.key) : null;
  if (!input.success || !key)
    return Response.json({ error: "Name the project as owner/repo with a title." }, { status: 400 });

  await keepFavorite(input.data.key, input.data.title);
  return Response.json({ ok: true });
}

/** `DELETE /api/projects/bookmarks?key=…`: takes a favorite off the list, leaving the project itself alone. */
export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Name the favorite to remove as `key`." }, { status: 400 });

  await forgetFavorite(key);
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
