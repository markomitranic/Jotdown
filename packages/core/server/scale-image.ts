/// <reference types="bun" />

/**
 * A picture scaled down to a width as WebP at quality 80, turned upright, and never scaled up.
 *
 * Bun decodes and encodes it with its own codecs, so nothing native is
 * installed. A picture narrower than the width keeps its own size, and its
 * colour profile survives.
 *
 * @example new Response(await scaleImage(bytes, 960), { headers: { "content-type": "image/webp" } });
 */
export function scaleImage(bytes: ArrayBuffer | Uint8Array, width: number) {
  return new Bun.Image(bytes).resize(width, undefined, { withoutEnlargement: true }).webp({ quality: 80 }).blob();
}
