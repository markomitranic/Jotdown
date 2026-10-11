"use client";

/**
 * The browser half of the live-edit wire protocol.
 *
 * Route handlers under a project's `live-edit` prefix: `source` and `save` for
 * a page, `asset` for an upload, `structure` for the sidebar, and `history` and
 * `revision` for a page's past.
 */

import type {
  ApiError,
  PageHistoryResponse,
  PageRevisionResponse,
  AssetResponse,
  LinkPreview,
  SaveRequest,
  SaveResponse,
  SourceResponse,
  StructureRequest,
  StructureResponse,
} from "../types";
import { UPLOAD_LIMITS, megabytes } from "../limits";

/** Both live next door, and every caller wants them alongside the requests. */
export { useDocTarget, useLiveEditConfig } from "./config";

/** How a request reaches the editing service: `fetch` in the studio, a message to the studio from a canvas. */
export type Transport = (url: string, init?: RequestInit) => Promise<Response>;

let transport: Transport = (url, init) => fetch(url, init);

/**
 * Sends every editing request through another way of reaching the service from now on.
 *
 * @example sendRequestsThrough(canvasTransport(window.parent, studioOrigin));
 */
export function sendRequestsThrough(next: Transport) {
  transport = next;
}

/**
 * A request the editing service refused, or one that never reached it.
 *
 * `status` is 0 when the request never reached the server, which the UI reports
 * as a connection problem rather than a save failure. `answer` is the body the
 * service gave, with the holder of a lock or the staged changes it refused.
 */
export class LiveEditFailure extends Error {
  readonly status: number;
  readonly answer: ApiError;

  constructor(status: number, answer: ApiError) {
    super(answer.error);
    this.status = status;
    this.answer = answer;
  }
}

/**
 * Whether a failure is the service answering `status`, a choice to offer rather than an error to show.
 *
 * @example refusedWith(error, 409); // true when the file changed since it was read
 */
export function refusedWith(error: unknown, status: number): error is LiveEditFailure {
  return error instanceof LiveEditFailure && error.status === status;
}

/** Reads the file as it is right now on the branch, not as this build baked it. */
export async function fetchSource(apiBase: string, path: string) {
  return request<SourceResponse>(`${apiBase}/source?path=${encodeURIComponent(path)}`);
}

/**
 * Commits the new text.
 *
 * A 409 is a choice rather than an error: the file was written elsewhere since
 * we read it, so the reader is offered a reload.
 */
export async function saveSource(apiBase: string, body: SaveRequest) {
  const payload = JSON.stringify(body);
  if (new TextEncoder().encode(payload).byteLength > UPLOAD_LIMITS.max) {
    throw new LiveEditFailure(413, {
      error: `These changes exceed the ${megabytes(UPLOAD_LIMITS.max)} save limit. Use smaller whiteboard images or save fewer drawings at once.`,
    });
  }
  return request<SaveResponse>(`${apiBase}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
}

/**
 * Commits a whole queue of staged sidebar changes at once.
 *
 * A 422 is the interesting answer: `error.refusals` says which staged change
 * was impossible and why, so the sidebar can mark that one row instead of
 * throwing away work the reader has done. A 423 means somebody else is
 * rearranging, and a 409 means the tree moved while this was in flight.
 */
export async function saveStructure(apiBase: string, body: StructureRequest) {
  return request<StructureResponse>(`${apiBase}/structure`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * One upload, and where it should land.
 *
 * An attachment names its own extension rather than letting the server read one
 * off a filename it never sees. That extension decides both the folder and the
 * `content-type` the file is served under, so the endpoint checks it against
 * its own allowlist before anything is committed.
 */
export type AssetUpload = {
  path: string;
  author: { name: string; email: string };
  file: Blob;
} & ({ kind: "image" } | { kind: "file"; ext: string });

/**
 * Commits one image or attachment and answers with the URL to reach it by.
 *
 * The body is the file, not JSON, so nothing is base64-encoded in the browser.
 * Everything the commit needs besides the bytes goes in the query string, which
 * `URLSearchParams` escapes, so a name with an accent in it survives the trip
 * where a header would have thrown.
 */
export async function uploadAsset(apiBase: string, upload: AssetUpload) {
  const query = new URLSearchParams({
    path: upload.path,
    name: upload.author.name,
    email: upload.author.email,
    kind: upload.kind,
    ...(upload.kind === "file" ? { ext: upload.ext } : {}),
  });

  return request<AssetResponse>(`${apiBase}/asset?${query}`, {
    method: "POST",
    headers: { "content-type": upload.file.type || "application/octet-stream" },
    body: upload.file,
  });
}

/**
 * Reads what a link embed shows off the page a link points at.
 *
 * Studio-wide rather than under a project's prefix, since a link belongs to no project.
 */
export async function fetchLinkPreview(url: string, signal: AbortSignal) {
  return request<LinkPreview>(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await transport(url, init).catch(() => null);
  if (!res) throw new LiveEditFailure(0, { error: "Could not reach the server. Check your connection and try again." });

  const body = await readJson(res);
  if (!res.ok)
    throw new LiveEditFailure(res.status, isApiError(body) ? body : { error: `The server answered ${res.status}.` });
  if (typeof body !== "object" || body === null) {
    throw new LiveEditFailure(res.status, {
      error: "Something other than the editing service answered. Reload and try again.",
    });
  }

  return body as T;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isApiError(body: unknown): body is ApiError {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  return typeof (body as { error?: unknown }).error === "string";
}

/** Reads a history page, pinned to the first response's head for subsequent requests. */
export async function fetchPageHistory(
  apiBase: string,
  path: string,
  page: number,
  head: string | undefined,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ path, page: String(page), ...(head ? { head } : {}) });
  return request<PageHistoryResponse>(`${apiBase}/history?${query}`, { signal, cache: "no-store" });
}

/** Reads historical Markdown without interpreting its contents. */
export async function fetchPageRevision(apiBase: string, path: string, sha: string, signal: AbortSignal) {
  const query = new URLSearchParams({ path, sha });
  return request<PageRevisionResponse>(`${apiBase}/revision?${query}`, { signal, cache: "no-store" });
}
