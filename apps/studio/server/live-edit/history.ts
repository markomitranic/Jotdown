import { errorResponse, parseContentPath } from "./_contract";
import { storage } from "../storage";
import { parseHistory, revisionText } from "./_history";

/** Returns a pinned history page and, on first load, the current saved Markdown. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const path = parseContentPath(query.get("path"));
  if (!path.ok) return errorResponse(path.failure);
  const pagination = parseHistory(query);
  if (!pagination.ok) return errorResponse(pagination.failure);
  const { page, head } = pagination.value;
  const history = await storage.listPageHistory(path.value, page, head);
  if (!history.ok) return errorResponse(history.failure);
  if (page !== 1) return Response.json(history.value, { headers: { "cache-control": "private, no-store" } });

  const current = await storage.readSource(path.value);
  if (!current.ok) return errorResponse(current.failure);
  const bounded = revisionText(Buffer.from(current.value.text));
  if (!bounded.ok) return errorResponse(bounded.failure);
  return Response.json(
    { ...history.value, current: current.value },
    { headers: { "cache-control": "private, no-store" } },
  );
}
