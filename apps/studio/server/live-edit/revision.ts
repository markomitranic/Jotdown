import { errorResponse, parseContentPath } from "./_contract";
import { storage } from "../storage";
import { parseRevision } from "./_history";

/** Returns inert Markdown from one commit, with null text for an absent file. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const path = parseContentPath(query.get("path"));
  if (!path.ok) return errorResponse(path.failure);
  const sha = parseRevision(query.get("sha"));
  if (!sha.ok) return errorResponse(sha.failure);
  const revision = await storage.readRevision(path.value, sha.value);
  return revision.ok
    ? Response.json(revision.value, { headers: { "cache-control": "private, no-store" } })
    : errorResponse(revision.failure);
}
