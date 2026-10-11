import type { SaveRequest } from "@jotdown/editor/types";
import { prepareWhiteboards } from "./_whiteboard";
import {
  errorResponse,
  jsonResponse,
  parseFilePath,
  parsePerson,
  readJsonBody,
  type Result,
  type Unparsed,
} from "./_contract";
import { storage } from "../storage";

/**
 * Commits an edited doc to the branch.
 *
 * `POST {apiBase}/save` taking a `SaveRequest` and answering with a
 * `SaveResponse`, whose `commitSha` the editor then polls the build stamp for
 * to know when its change is live.
 *
 * A stale `sha` comes back as a 409 carrying both shas, so the editor can offer
 * a reload instead of overwriting a change made elsewhere.
 */
export async function POST(request: Request) {
  const save = parseSaveRequest(await readJsonBody(request));
  if (!save.ok) return errorResponse(save.failure);

  const prepared = prepareWhiteboards(save.value.text, await storage.uploadsFolder());
  if (!prepared.ok) return errorResponse(prepared.failure);

  const saved = await storage.commitFile({ ...save.value, text: prepared.value.text }, prepared.value.additions);

  return saved.ok ? jsonResponse(saved.value) : errorResponse(saved.failure);
}

/**
 * Narrows an untrusted request body to a `SaveRequest`.
 *
 * The path goes through the same allowlist the read endpoint uses, so a save
 * cannot reach a file the editor was never able to open.
 */
function parseSaveRequest(body: unknown): Result<SaveRequest> {
  const { path, text, sha, message, author } = (body ?? {}) as Unparsed<SaveRequest>;

  const contentPath = parseFilePath(typeof path === "string" ? path : null);
  if (!contentPath.ok) return contentPath;

  if (typeof text !== "string" || typeof sha !== "string" || typeof message !== "string") {
    return {
      ok: false,
      failure: { status: 400, error: "Expected `text`, `sha` and `message` strings." },
    };
  }

  const writer = parsePerson(author);
  if (!writer.ok) return writer;

  return {
    ok: true,
    value: {
      path: contentPath.value,
      text,
      sha,
      message,
      author: writer.value,
    },
  };
}
