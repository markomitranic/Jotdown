import { parseProjectKey } from "@/lib/project-key";
import { localSession } from "@/server/auth/session";
import { storage } from "@/server/storage";
import { scaledOriginal } from "@jotdown/core/lib/images";
import { scaleImage } from "@jotdown/core/server/scale-image";
import { uploadType } from "@jotdown/core/server/uploads";

const SHA = /^[0-9a-f]{40}$/;
const KEPT = "public, max-age=31536000, s-maxage=31536000, immutable";

/**
 * Serves one upload of a GitHub project by its blob sha, cached for good in the browser and the CDN.
 *
 * A blob's sha is its content, so the bytes at an address never change, and
 * only somebody who was shown the file can name it. GitHub is read with the
 * editor's own token. The file name gives the content type and the name a
 * download is saved under.
 *
 * A name ending in a width, `a.png.w960.webp`, asks for the picture scaled
 * down to it as WebP, which is just as fixed as the blob it is made from.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ owner: string; repo: string; sha: string; name: string }> },
) {
  const { owner, repo, sha, name } = await context.params;
  const key = parseProjectKey(`${owner}/${repo}`);
  if (!key || !SHA.test(sha)) return new Response(null, { status: 404 });

  const blob = await storage.readBlob(key, (await localSession()).token, sha).catch(() => null);
  if (!blob) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

  const scaled = scaledOriginal(name);
  const body = scaled ? await scaleImage(await blob.arrayBuffer(), scaled.width).catch(() => null) : blob.body;
  if (body === null) return new Response(null, { status: 415, headers: { "cache-control": "no-store" } });

  return new Response(body, {
    headers: {
      "content-type": uploadType(name),
      "cache-control": KEPT,
      "content-security-policy": "sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}

export const dynamic = "force-dynamic";
