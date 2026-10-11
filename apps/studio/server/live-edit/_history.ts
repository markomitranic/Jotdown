import type { PageRevision } from "@jotdown/editor/types";
import type { Result } from "./_contract";

export const HISTORY_PAGE_SIZE = 30;
export const MAX_REVISION_BYTES = 1_000_000;

/** Validates a full commit ID before a repository lookup. */
export function parseRevision(raw: string | null): Result<string> {
  return raw && /^[a-f0-9]{40}$/i.test(raw)
    ? { ok: true, value: raw.toLowerCase() }
    : { ok: false, failure: { status: 400, error: "Expected a full 40-character commit SHA." } };
}

/** Reads bounded pagination and the immutable history starting point from a URL. */
export function parseHistory(query: URLSearchParams) {
  const page = query.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/.test(page)) {
    return { ok: false, failure: { status: 400, error: "Expected a page between 1 and 9999." } } as const;
  }
  const raw = query.get("head");
  const head = raw === null ? null : parseRevision(raw);
  if (head && !head.ok) return head;
  if (Number(page) > 1 && !head) {
    return { ok: false, failure: { status: 400, error: "Older pages require the history's starting SHA." } } as const;
  }
  return { ok: true, value: { page: Number(page), head: head?.value } } as const;
}

/** Extracts human coauthors, falling back to the commit author when none are recorded. */
export function revisionAuthors(message: string, author: PageRevision["authors"][number]) {
  const coauthors = [...message.matchAll(/^Co-authored-by:\s*(.+?)\s*<([^<>\r\n]+)>\s*$/gim)].flatMap(
    ([, name, email]) => (name && email ? [{ name: name.trim(), email: email.trim() }] : []),
  );
  return coauthors.length
    ? coauthors.filter(
        (person, index) =>
          coauthors.findIndex((other) => other.email.toLowerCase() === person.email.toLowerCase()) === index,
      )
    : [author];
}

/** Decodes bounded UTF-8 source without changing line endings or accepting binary data. */
export function revisionText(bytes: Uint8Array): Result<string> {
  if (bytes.byteLength > MAX_REVISION_BYTES) {
    return { ok: false, failure: { status: 422, error: "This version exceeds the 1 MB source limit." } };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("Binary content");
    return { ok: true, value: text };
  } catch {
    return { ok: false, failure: { status: 422, error: "This version is not UTF-8 Markdown." } };
  }
}
