import { readyUpdate, restartToUpdate } from "@/server/updates";

/** `GET /api/update`: the downloaded Jotdown update waiting for a restart, or `null`. */
export async function GET() {
  return Response.json({ update: await readyUpdate() });
}

/** `POST /api/update`: restarts the app into the downloaded update. */
export async function POST() {
  if (await restartToUpdate()) return Response.json({ ok: true });
  return Response.json({ error: "Only the Jotdown app can restart to update." }, { status: 404 });
}

export const dynamic = "force-dynamic";
