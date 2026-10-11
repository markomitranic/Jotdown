import { createHash } from "node:crypto";
import { errorResponse, jsonResponse, parseContentPath, parsePerson, type Result } from "./_contract";
import { storage } from "../storage";
import { UPLOAD_LIMITS, megabytes } from "@jotdown/editor/limits";

/**
 * Commits an image or a file dropped into the editor.
 *
 * `POST {apiBase}/asset?kind=…&path=docs/foo.md&name=…&email=…` whose body
 * is the upload itself, answering with an `AssetResponse`. The details ride in
 * the query string because the body is raw bytes and has no room for them.
 *
 * The `path` is the page being edited. Nothing is written to it: it names the
 * commit, so the history says which page an upload was made for. It still goes
 * through the same allowlist the read and write endpoints use, so an unknown
 * path is refused before anything is committed.
 *
 * Both kinds land under a name that is a hash of their own bytes, which makes
 * an upload idempotent and means two pages sharing one screenshot share the
 * file rather than carrying a copy each. For a file that also means the URL
 * says nothing about what it holds, which is why the browser sends the real
 * name along and puts it on the link's `download` attribute.
 */
export async function POST(request: Request) {
  const query = new URL(request.url).searchParams;

  const page = parseContentPath(query.get("path"));
  if (!page.ok) return errorResponse(page.failure);

  const author = parsePerson({ name: query.get("name"), email: query.get("email") });
  if (!author.ok) return errorResponse(author.failure);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (arrivedShort(request, bytes)) {
    return errorResponse({ status: 413, error: "The file arrived incomplete, so nothing was committed. Try again." });
  }

  const upload = query.get("kind") === "file" ? describeFile(bytes, query.get("ext")) : describeImage(bytes);
  if (!upload.ok) return errorResponse(upload.failure);

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const address = `/${upload.value.dir}/${hash}.${upload.value.extension}`;

  const saved = await storage.commitAsset({
    path: `${await storage.uploadsFolder()}${address}`,
    url: address,
    bytes,
    message: `docs: (studio) ${upload.value.what} to ${page.value}`,
    author: author.value,
  });

  return saved.ok ? jsonResponse(saved.value) : errorResponse(saved.failure);
}

/** Where an upload is served under, and what its commit says. */
type Upload = { dir: string; extension: string; what: string };

/** Uploads are served from the site root, as `/img/docs/` and `/files/docs/`, and kept under the same paths in the uploads folder. */
const IMAGE_DIR = "img/docs";
const FILE_DIR = "files/docs";

/**
 * The ceiling on one image or attachment.
 *
 * The browser asks about anything this big before sending it, so this is the
 * backstop rather than the message somebody normally sees.
 */
const MAX_BYTES = UPLOAD_LIMITS.max;

/**
 * Whether fewer bytes arrived than the browser said it sent.
 *
 * Next's proxy hands a route only as much of a body as it buffers, without
 * failing the request, and a picture cut short still starts with a valid
 * header. Committing that would be a broken file nobody notices.
 *
 * @example arrivedShort(request, bytes); // true for 10 MB of a 12 MB upload
 */
export function arrivedShort(request: Request, bytes: Uint8Array) {
  const declared = Number(request.headers.get("content-length"));
  return declared > 0 && bytes.byteLength < declared;
}

/**
 * Extensions an attachment may have.
 *
 * The extension is the whole check, because it is also what decides the
 * `content-type` the file is later served under. `svg`, `html` and `xml` are
 * absent for the reason SVG is kept out of images: each one is a document the
 * browser will execute on our own origin the moment somebody opens the URL.
 * There is no signature to sniff for a zip's contents, so the answer is to
 * control what the file can be served as instead.
 */
const FILE_EXTENSIONS = ["pdf", "zip", "csv", "json", "txt", "docx", "xlsx", "pptx"];

/**
 * Checks an attachment's claimed extension and size.
 *
 * @example describeFile(bytes, "zip"); // { ok: true, value: { … } }
 */
function describeFile(bytes: Uint8Array, ext: string | null): Result<Upload> {
  const extension = fileExtension(ext);

  if (extension === null) {
    return {
      ok: false,
      failure: {
        status: 415,
        error: `Attachments have to be one of ${FILE_EXTENSIONS.join(", ")}. Zip it and upload that instead.`,
      },
    };
  }

  if (bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      failure: {
        status: 413,
        error: `Attachments have to be under ${megabytes(MAX_BYTES)}. Put a bigger one in Drive and link to it.`,
      },
    };
  }

  return { ok: true, value: { dir: FILE_DIR, extension, what: "attach a file" } };
}

/** Checks an image's actual bytes and size. */
function describeImage(bytes: Uint8Array): Result<Upload> {
  const kind = imageKind(bytes);

  if (kind === null) {
    return {
      ok: false,
      failure: { status: 415, error: "That is not a PNG, JPEG, GIF or WebP image." },
    };
  }

  if (bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      failure: {
        status: 413,
        error: `Images have to be under ${megabytes(MAX_BYTES)}. Compress it or export a smaller one.`,
      },
    };
  }

  return { ok: true, value: { dir: IMAGE_DIR, extension: kind, what: "add an image" } };
}

/**
 * The extension to store an attachment under, or null when it is not allowed.
 *
 * @example fileExtension(".ZIP"); // "zip"
 */
export function fileExtension(ext: string | null): string | null {
  const extension = (ext ?? "").trim().toLowerCase().replace(/^\./, "");
  return FILE_EXTENSIONS.includes(extension) ? extension : null;
}

/**
 * The formats an image upload may be in, as the bytes each one starts with.
 *
 * Written as hex so WebP can say what it means: `RIFF`, four bytes of length
 * that are none of our business, then `WEBP`. The browser's `content-type` is
 * not consulted anywhere, because it is whatever the sender says it is, and the
 * one thing this check is for is keeping SVG out. An SVG is a script that runs
 * on our own origin the moment somebody opens the image.
 */
const SIGNATURES = {
  png: /^89504e47/,
  jpg: /^ffd8ff/,
  gif: /^47494638/,
  webp: /^52494646[0-9a-f]{8}57454250/,
} as const;

/**
 * Which format these bytes are, read off the front of the file.
 *
 * @example imageKind(new Uint8Array([0xff, 0xd8, 0xff])); // "jpg"
 */
export function imageKind(bytes: Uint8Array): keyof typeof SIGNATURES | null {
  const head = Buffer.from(bytes.subarray(0, 16)).toString("hex");

  for (const [kind, signature] of Object.entries(SIGNATURES)) {
    if (signature.test(head)) return kind as keyof typeof SIGNATURES;
  }

  return null;
}
