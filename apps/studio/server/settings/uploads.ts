import { createHash } from "node:crypto";
import { UPLOAD_LIMITS, megabytes } from "@jotdown/editor/limits";
import type { Session } from "../auth/session";
import { errorResponse, type Result } from "../live-edit/_contract";
import { arrivedShort, imageKind } from "../live-edit/asset";
import { storage } from "../storage";

/**
 * The files a project's settings point at: its icon and logo, and its typefaces.
 *
 * Each lands under a name that is a hash of its bytes, so choosing the same file
 * twice commits it once, and a settings draft nobody saves leaves at most one
 * stray file behind.
 */

/** What an upload is, where it is served from, and what its commit says. */
export type BrandUpload = { kind: "image" | "font"; extension: string };

/** Where each kind of brand file is kept in the uploads folder, and the address the config names it by. */
const SHELVES = {
  image: { folder: "img/brand", address: "/img/brand" },
  font: { folder: "fonts", address: "/uploads/fonts" },
} as const;

/** A font file's format, read off the bytes it starts with. */
const FONT_SIGNATURES = {
  woff2: /^774f4632/,
  woff: /^774f4646/,
  ttf: /^(00010000|74727565)/,
  otf: /^4f54544f/,
} as const;

/**
 * Which font format these bytes are, or null for anything else.
 *
 * @example fontKind(new Uint8Array([0x77, 0x4f, 0x46, 0x32])); // "woff2"
 */
export function fontKind(bytes: Uint8Array): keyof typeof FONT_SIGNATURES | null {
  const head = Buffer.from(bytes.subarray(0, 4)).toString("hex");

  for (const [kind, signature] of Object.entries(FONT_SIGNATURES)) {
    if (signature.test(head)) return kind as keyof typeof FONT_SIGNATURES;
  }

  return null;
}

/**
 * Reads an upload's real format off its bytes, refusing SVG and anything too big.
 *
 * SVG is kept out for the reason the editor keeps it out: it is a script that
 * runs on the studio's own origin the moment somebody opens it. The browser
 * draws an SVG icon into a PNG before it gets here.
 */
export function describeUpload(kind: string | null, bytes: Uint8Array): Result<BrandUpload> {
  if (kind !== "image" && kind !== "font") {
    return { ok: false, failure: { status: 400, error: "Say whether the upload is an image or a font." } };
  }

  if (bytes.byteLength > UPLOAD_LIMITS.max) {
    return { ok: false, failure: { status: 413, error: `Uploads have to be under ${megabytes(UPLOAD_LIMITS.max)}.` } };
  }

  if (kind === "font") {
    const extension = fontKind(bytes);
    return extension
      ? { ok: true, value: { kind: "font", extension } }
      : { ok: false, failure: { status: 415, error: "That is not a WOFF2, WOFF, TTF or OTF font." } };
  }

  const extension = imageKind(bytes);
  return extension
    ? { ok: true, value: { kind: "image", extension } }
    : { ok: false, failure: { status: 415, error: "That is not a PNG, JPEG, GIF or WebP image." } };
}

/**
 * Commits a brand file and answers with the address the config names it by.
 *
 * Images are served as `/img/brand/…`, fonts as `/uploads/fonts/…`, the two
 * shapes the config's schema accepts for each.
 *
 * @example await commitBrandFile(bytes, upload, "the icon", session); // { ok: true, value: { url: "/img/brand/3f1c….png" } }
 */
export async function commitBrandFile(bytes: Uint8Array, upload: BrandUpload, what: string, session: Session) {
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${upload.extension}`;
  const { folder, address } = SHELVES[upload.kind];
  const url = `${address}/${name}`;

  const saved = await storage.commitAsset({
    path: `${await storage.uploadsFolder()}/${folder}/${name}`,
    url,
    bytes,
    message: `docs: (studio) settings: add ${what}`,
    author: session.editor,
  });

  return saved.ok ? ({ ok: true, value: { url } } as const) : saved;
}

/** `POST settings/upload?kind=image|font&what=…` with the file as the body. */
export async function upload(request: Request, session: Session) {
  const query = new URL(request.url).searchParams;
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (arrivedShort(request, bytes)) {
    return errorResponse({ status: 413, error: "The file arrived incomplete, so nothing was committed. Try again." });
  }

  const described = describeUpload(query.get("kind"), bytes);
  if (!described.ok) return errorResponse(described.failure);

  const what = (query.get("what") ?? "").replace(/[^\w .-]/g, "").slice(0, 40) || `a ${described.value.kind}`;
  const saved = await commitBrandFile(bytes, described.value, what, session);
  return saved.ok ? Response.json(saved.value) : errorResponse(saved.failure);
}
