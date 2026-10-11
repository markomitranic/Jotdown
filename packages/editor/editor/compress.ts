import { COMPRESSION } from "../limits";

/**
 * A picture redrawn as WebP inside a 1920 pixel square at quality 80, or null when it cannot be read.
 *
 * Only ever run when somebody asked for it. Transparency survives; an animated
 * GIF keeps its first frame. The file keeps its name, with the extension it
 * now has.
 *
 * @example await compressPicture(file); // File "welcome.webp", or null
 */
export async function compressPicture(file: File): Promise<File | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (bitmap === null) return null;

  const scale = Math.min(1, COMPRESSION.edge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: COMPRESSION.type, quality: COMPRESSION.quality }).catch(() => null);
  if (blob === null || blob.type !== COMPRESSION.type) return null;

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: COMPRESSION.type });
}
