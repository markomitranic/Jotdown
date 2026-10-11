const SIZE = 512;

/**
 * An image drawn into a transparent 512-pixel square, centred and never cropped, as a PNG.
 *
 * Every icon a project gets is this one square, so a wide logo shrinks to fit
 * rather than pushing the title aside. SVG, PNG, JPEG and WebP all go in.
 *
 * @example await drawIcon(file); // { base64: "iVBORw0KGgo…", preview: "data:image/png;base64,iVBORw0KGgo…" }
 */
export async function drawIcon(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image: SVG, PNG, JPEG or WebP.");

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const scale = Math.min(SIZE / image.naturalWidth, SIZE / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  canvas.getContext("2d")?.drawImage(image, (SIZE - width) / 2, (SIZE - height) / 2, width, height);

  const preview = canvas.toDataURL("image/png");
  return { base64: preview.slice(preview.indexOf(",") + 1), preview };
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
