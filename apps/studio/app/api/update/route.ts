import { availableUpdate } from "@/server/updates";

/** `GET /api/update`: a newer Jotdown release, or `null` when this app is the newest. */
export async function GET() {
  return Response.json({ update: await availableUpdate() });
}

export const dynamic = "force-dynamic";
