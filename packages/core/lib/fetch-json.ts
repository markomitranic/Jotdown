/** A request the server answered with an error, carrying the whole answer for a caller that wants more than its sentence. */
export class FetchFailure extends Error {
  readonly answer: Record<string, unknown>;

  constructor(message: string, answer: Record<string, unknown>) {
    super(message);
    this.answer = answer;
  }
}

/**
 * One JSON request, answering the body or throwing the reason the server gave.
 *
 * A server's `{ error }` becomes the thrown message; a body that is not JSON,
 * or a request that never arrived, throws a sentence fit to show a reader.
 *
 * @example await fetchJson<{ projects: ProjectListing[] }>("/api/projects"); // { projects: [...] }
 */
export async function fetchJson<T>(address: string, init?: RequestInit): Promise<T> {
  const response = await fetch(address, init).catch(() => null);
  if (!response) throw new Error("Could not reach the server. Check your connection and try again.");

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new FetchFailure(body.error ?? `The server answered ${response.status}.`, body);
  return body as T;
}

/**
 * The same request as a JSON `POST` of `body`.
 *
 * @example await postJson<{ ok: true }>("/api/projects", { action: "download", key: "you/site" });
 */
export function postJson<T>(address: string, body: unknown, init?: RequestInit): Promise<T> {
  return fetchJson<T>(address, {
    ...init,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
