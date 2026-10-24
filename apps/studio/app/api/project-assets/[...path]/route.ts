import { currentProjectKey } from "@/server/projects/context";
import { localSession } from "@/server/auth/session";
import { storage } from "@/server/storage";
import { scaledAddress, scaledOriginal } from "@jotdown/core/lib/images";
import { scaleImage } from "@jotdown/core/server/scale-image";
import { uploadType } from "@jotdown/core/server/uploads";

const UPLOAD = /^(uploads|img|files|whiteboards)\//;

/**
 * Serves an upload of the open project, read as the editor.
 *
 * The request proxy rewrites `/img/…`, `/files/…`, `/whiteboards/…` and
 * `/uploads/…` here, each a file of the project's uploads folder.
 *
 * A GitHub project's upload is sent on to its blob address at the branch
 * head, which keeps the bytes for good; a folder's is read in place. Either
 * answer older than five minutes is used at once and asked again behind it.
 *
 * A picture's WebP copy, `a.png.w960.webp`, is scaled from the original on
 * request, and a GitHub project's is sent on to the copy of its blob.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\\")))
    return new Response(null, { status: 400 });
  const path = parts.join("/");
  if (!UPLOAD.test(path)) return new Response(null, { status: 404 });

  const headers = {
    "content-type": uploadType(path),
    "cache-control": "private, max-age=300, stale-while-revalidate=2592000",
    "content-security-policy": "sandbox",
    "x-content-type-options": "nosniff",
  };

  const key = await currentProjectKey();
  if (!key) return new Response(null, { status: 404 });

  const scaled = scaledOriginal(path);
  const upload = await storage.readUpload(key, await localSession(), scaled?.original ?? path).catch(() => null);
  if (!upload) return new Response(null, { status: 404 });

  const location = upload.headers.get("location");
  if (location)
    return new Response(null, {
      status: upload.status,
      headers: { ...headers, location: scaled ? scaledAddress(location, scaled.width) : location },
    });
  if (!scaled) return new Response(upload.body, { status: upload.status, headers });

  const bytes = await scaleImage(await upload.arrayBuffer(), scaled.width).catch(() => null);
  return bytes ? new Response(bytes, { headers }) : new Response(null, { status: 415 });
}

export const dynamic = "force-dynamic";
