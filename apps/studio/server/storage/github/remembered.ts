/**
 * Reads from GitHub that send back the ETag of the last answer, so one that has not changed costs no rate limit.
 *
 * GitHub answers a matching `If-None-Match` with a 304, which it does not
 * count against the token's hourly limit, and the answer remembered here
 * stands in for it. Answers are kept per token and address, in this server
 * instance's memory, which is enough for the polls that ask the same thing
 * every minute.
 */

const answers = new Map<string, { etag: string; body: string; type: string }>();

/**
 * Fetches a GitHub address, answering from memory when GitHub says it has not changed.
 *
 * @example await fetchRemembered(`${API}/repos/you/site/git/ref/heads/main`, { headers, signal }); // a 200 either way
 */
export async function fetchRemembered(url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) {
  const key = `${init.headers.authorization ?? ""} ${url}`;
  const known = answers.get(key);

  const response = await fetch(url, {
    ...init,
    headers: known ? { ...init.headers, "if-none-match": known.etag } : init.headers,
  });
  if (response.status === 304 && known) return new Response(known.body, { headers: { "content-type": known.type } });

  const etag = response.headers.get("etag");
  if (!response.ok || !etag) return response;

  const body = await response.text();
  const type = response.headers.get("content-type") ?? "application/json";
  answers.set(key, { etag, body, type });
  return new Response(body, { status: response.status, headers: { "content-type": type } });
}
