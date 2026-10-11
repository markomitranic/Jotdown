import { z } from "zod";
import { addFolder, browseFolder, expandHome, homeRelative, projectTitle } from "@/server/storage/disk/folders";

const NO_STORE = { "cache-control": "no-store" };
const addSchema = z.object({ path: z.string().min(1) });

/**
 * `GET /api/folders?path=~/Sites`: the folders inside one folder of this machine, for the folder browser.
 *
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "~";
  try {
    return Response.json(await browseFolder(path), { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: `${homeRelative(expandHome(path))} could not be read.` },
      { status: 404, headers: NO_STORE },
    );
  }
}

/** `POST /api/folders` with `{ path }`: bookmarks a folder holding a `.jotdown/config.json`, answering its key and title. */
export async function POST(request: Request) {
  const input = addSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Name the folder to add as `path`." }, { status: 400 });

  try {
    const folder = await addFolder(input.data.path);
    return Response.json({ key: folder.key, title: projectTitle(folder.path) }, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The folder could not be added." },
      { status: 422, headers: NO_STORE },
    );
  }
}

export const dynamic = "force-dynamic";
