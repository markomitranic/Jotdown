"use client";

/**
 * An image drawn into a PNG, fitted into a box and keeping its shape, so an SVG or a huge photo arrives as a sensible file.
 *
 * A `square` box is the box itself, transparent around an image of another
 * shape and filled by scaling up a small one, which is how every icon slot
 * expects its mark. Otherwise the PNG is the image's own shape, only ever
 * scaled down. SVG, PNG, JPEG and WebP all go in.
 *
 * @example await drawPng(file, { width: 512, height: 512, square: true }); // { blob, preview: "data:image/png;base64,…" }
 * @example await drawPng(file, { width: 1600, height: 400 }); // a 1600×400 PNG of a 4:1 logo
 */
export async function drawPng(
  file: File,
  { width, height, square = false }: { width: number; height: number; square?: boolean },
) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image: SVG, PNG, JPEG or WebP.");

  const image = await loadImage(file);
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const scale = square ? fit : Math.min(1, fit);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;

  const canvas = document.createElement("canvas");
  canvas.width = square ? width : Math.round(drawnWidth);
  canvas.height = square ? height : Math.round(drawnHeight);
  canvas
    .getContext("2d")
    ?.drawImage(image, (canvas.width - drawnWidth) / 2, (canvas.height - drawnHeight) / 2, drawnWidth, drawnHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("That image could not be drawn.");
  return { blob, preview: canvas.toDataURL("image/png") };
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("That image has no size. An SVG needs a width and height, or a viewBox.");
    return image;
  } catch (error) {
    throw error instanceof Error && error.message.includes("no size")
      ? error
      : new Error("That image could not be read.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
