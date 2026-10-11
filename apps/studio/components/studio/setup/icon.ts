import { drawPng } from "../images";

/**
 * An image drawn into a transparent 512-pixel square, centred and never cropped, as a PNG and its base64.
 *
 * Every icon a project gets is this one square, so a wide logo shrinks to fit
 * rather than pushing the title aside. The wizard sends the base64 with its answers.
 *
 * @example await drawIcon(file); // { base64: "iVBORw0KGgo…", preview: "data:image/png;base64,iVBORw0KGgo…" }
 */
export async function drawIcon(file: File) {
  const { preview } = await drawPng(file, { width: 512, height: 512, square: true });
  return { base64: preview.slice(preview.indexOf(",") + 1), preview };
}
