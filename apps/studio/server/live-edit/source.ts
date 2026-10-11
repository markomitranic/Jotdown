import { errorResponse, jsonResponse, parseFilePath } from "./_contract";
import { storage } from "../storage";

/**
 * Hands the editor a doc's current text and blob sha.
 *
 * `GET {apiBase}/source?path=docs/foo.mdx` answering with a
 * `SourceResponse`.
 *
 * The read goes to GitHub at branch HEAD rather than to the files in this
 * deploy. A reader may be looking at a build that is minutes old, and opening
 * the editor on that stale copy would mean saving it back over whatever landed
 * since.
 */
export async function GET(request: Request) {
  const path = parseFilePath(new URL(request.url).searchParams.get("path"));
  if (!path.ok) return errorResponse(path.failure);

  const source = await storage.readSource(path.value);

  return source.ok ? jsonResponse(source.value) : errorResponse(source.failure);
}
