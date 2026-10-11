import { DOCS_ROOT, linkIn, separatorIn, META_FILE, MOVED_FILE, PATH_SEGMENT } from "@jotdown/core/lib/paths";
import type { ApiError, AssetResponse, SaveResponse, SourceResponse, StructureResponse } from "@jotdown/editor/types";

/**
 * What every live-edit endpoint and every storage agree on: the paths a
 * request may name and how an answer is sent.
 *
 * Every call returns a `Result` rather than throwing. An endpoint is a short
 * chain of steps that each either continue or become an HTTP status, and
 * exceptions would hide which step failed.
 */

/** An HTTP status paired with the `ApiError` body to send with it. */
export type Failure = { status: number } & ApiError;

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

/**
 * Files the editor may read and write, as one anchored allowlist.
 *
 * Every segment has to start with a letter or digit, which makes `..` and
 * dotfiles unrepresentable rather than merely filtered out. A path must sit
 * under the content root and end in `.md` or `.mdx`, so `next.config.ts`,
 * `proxy.ts` and `.github/workflows` are all unreachable however the
 * request dresses them up: `%2e%2e/` fails on the `%`, a Windows separator
 * fails on the `\`, and a leading `/` fails on the anchor.
 *
 * The path counts from the project folder; the project's own place in its
 * repository is added by `repoPath` only when the request goes to GitHub.
 */
export const CONTENT_PATH = new RegExp(`^${DOCS_ROOT}/(?:${PATH_SEGMENT}/)*${PATH_SEGMENT}\\.mdx?$`);

/**
 * Checks a browser-supplied path against the allowlist.
 *
 * This is the security boundary for both endpoints. The path is interpolated
 * into a URL that writes to the repo, so it is validated once, here, and the
 * validated string is the only thing the rest of the module will touch.
 *
 * @example parseContentPath("docs/../middleware.ts"); // { ok: false, ... }
 */
export function parseContentPath(raw: string | null): Result<string> {
  if (!raw) {
    return { ok: false, failure: { status: 400, error: "A `path` is required." } };
  }

  if (!CONTENT_PATH.test(raw)) {
    return {
      ok: false,
      failure: {
        status: 400,
        error: `${raw} is not an editable path. Expected a .md or .mdx file under ${DOCS_ROOT}/.`,
      },
    };
  }

  return { ok: true, value: raw };
}

/**
 * Checks a path for reading and saving as a whole file: a page, a `meta.json` or the move record.
 *
 * The two JSON files are the ones a project breaks by hand and the studio
 * offers to fix in place, so they are reachable here as well as through the
 * structure endpoint.
 *
 * @example parseFilePath("docs/guides/meta.json"); // { ok: true, value: "docs/guides/meta.json" }
 */
export function parseFilePath(raw: string | null): Result<string> {
  return raw && (META_PATH.test(raw) || raw === MOVED_FILE) ? { ok: true, value: raw } : parseContentPath(raw);
}

/**
 * Files the structure endpoint may write besides docs themselves.
 *
 * A `meta.json` names a folder and orders the things inside it, and there is one
 * per folder including the docs root, which is why the segment group repeats
 * zero or more times rather than one or more. `moved.json` is the record of
 * every page that changed address, which `next.config.ts` turns into redirects
 * at build time. Both are spelt out rather than loosely matched, so widening
 * this is a deliberate edit and never a regex being generous.
 */
export const META_PATH = new RegExp(`^${DOCS_ROOT}/(?:${PATH_SEGMENT}/)*${META_FILE.replace(/\./g, "\\.")}$`);

/** One page or section name in a `pages` array, on the same rules as a path segment. */
const ORDER_NAME = new RegExp(`^${PATH_SEGMENT}$`);

/** True for an entry a reorder may place: a page, a section, a sidebar link or a separator. */
function isOrderName(name: unknown) {
  return typeof name === "string" && (ORDER_NAME.test(name) || linkIn(name) !== null || separatorIn(name) !== null);
}

/**
 * Checks a browser-supplied list of names before it goes into a `pages` array.
 *
 * Nothing here can reach outside that one file, so this is about keeping it
 * readable rather than about escaping: a name that could never be a filename
 * would sit in the array forever being ignored. The trailing `"..."` that keeps
 * unlisted pages visible is added when the array is written, which is why this
 * rejects it rather than expecting it. A sidebar link or a separator is sent
 * spelt as the entry it is, since a reorder is also how one is added, moved or
 * removed.
 *
 * @example parseOrderNames(["boundaries", "shapes"]); // { ok: true, ... }
 * @example parseOrderNames(["index", "[Next.js](https://nextjs.org/docs)"]); // { ok: true, ... }
 */
export function parseOrderNames(raw: unknown): Result<string[]> {
  const rejected: Result<string[]> = {
    ok: false,
    failure: { status: 400, error: "Expected a list of page and section names." },
  };

  if (!Array.isArray(raw)) return rejected;
  if (!raw.every(isOrderName)) return rejected;

  return { ok: true, value: raw as string[] };
}

/** A folder under `docs/`, which is what a new section is before it has files. */
const FOLDER_PATH = /^docs\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Checks a browser-supplied folder against the same rules as a file.
 *
 * A new section arrives as the folder it will become, since neither its
 * `index.mdx` nor its `meta.json` exists yet for a path check to bite on.
 *
 * @example parseFolderPath("docs/architecture/patterns"); // { ok: true, ... }
 */
export function parseFolderPath(raw: string | null): Result<string> {
  if (!raw || !FOLDER_PATH.test(raw)) {
    return {
      ok: false,
      failure: { status: 400, error: `${raw} is not a folder that can hold a section.` },
    };
  }

  return { ok: true, value: raw };
}

/**
 * The same check, plus `docs` itself, for the one op that may name the root.
 *
 * The docs root has a `meta.json` like every other folder, so reordering the top
 * level is an ordinary thing to ask for. Creating, renaming or moving the root
 * is not, which is why those keep the stricter check rather than this one.
 *
 * @example parseOrderFolder("docs"); // { ok: true, value: "docs" }
 */
export function parseOrderFolder(raw: string | null): Result<string> {
  return raw === DOCS_ROOT ? { ok: true, value: DOCS_ROOT } : parseFolderPath(raw);
}

const NO_STORE = { "cache-control": "no-store" };

/** Sends a successful body, never cached, since the editor needs the latest saved text. */
export function jsonResponse(value: SourceResponse | SaveResponse | AssetResponse | StructureResponse) {
  return Response.json(value, { headers: NO_STORE });
}

/** Sends a `Failure` as its status and an `ApiError` body. */
export function errorResponse({ status, ...body }: Failure) {
  return Response.json(body satisfies ApiError, { status, headers: NO_STORE });
}

/** Every field of a request body, before anything has been checked. */
export type Unparsed<T> = Partial<Record<keyof T, unknown>>;

/** Reads a JSON body, treating a malformed one as an absent one. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Reads a commit author's name and email out of an untrusted body.
 *
 * Both are written into a git object, so each gets a ceiling of 254
 * characters, the longest address SMTP will carry.
 *
 * @example parsePerson({ name: "Marko" }); // { ok: false, ... }
 */
export function parsePerson(value: unknown): Result<{ name: string; email: string }> {
  const { name, email } = (value ?? {}) as Unparsed<{ name: string; email: string }>;

  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.includes("@")) {
    return {
      ok: false,
      failure: { status: 400, error: "`author` needs a `name` and an email address." },
    };
  }

  if (name.length > 254 || email.length > 254) {
    return {
      ok: false,
      failure: { status: 400, error: "That `author` name or address is implausibly long." },
    };
  }

  return { ok: true, value: { name, email } };
}
