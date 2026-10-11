import { parseProjectKey, formatProjectKey } from "@/lib/project-key";
import { devServer } from "@/server/canvas/dev-server";
import { folderAt } from "@/server/storage/disk/folders";

/**
 * `GET /api/canvas/dev?key=local/notes`: the folder's own dev server, started on the first ask, and where it stands.
 *
 * `retry=1` starts it again after it failed.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const key = parseProjectKey(query.get("key") ?? "");
  const folder = key && (await folderAt(formatProjectKey(key)));
  if (!folder) return Response.json({ error: "Only a folder on this machine has a dev server." }, { status: 404 });

  return Response.json(devServer(folder.path, query.get("retry") === "1"), {
    headers: { "cache-control": "no-store" },
  });
}

export const dynamic = "force-dynamic";
