/**
 * Puts the picture at an address on the clipboard as the file itself, never a scaled copy.
 *
 * A clipboard takes pictures as PNG only, so any other format is drawn once
 * and handed over as PNG. The clipboard item is made at once with the picture
 * still on its way, because Safari only lets a click write to the clipboard
 * while that click is still being handled.
 *
 * @example await copyImage("/api/blobs/you/notes/3f1c…/welcome.png");
 */
export function copyImage(url: string) {
  return navigator.clipboard.write([new ClipboardItem({ "image/png": pngOf(url) })]);
}

/** The picture at an address as a PNG blob, drawn on a canvas when it arrives as anything else. */
async function pngOf(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The picture answered ${response.status}.`);

  const blob = await response.blob();
  if (blob.type === "image/png") return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/png" });
}

/**
 * The name a picture is saved under, read off the last segment of its address.
 *
 * @example imageFileName("/api/blobs/you/notes/3f1c…/welcome%20page.png"); // "welcome page.png"
 * @example imageFileName("blob:https://studio.test/0f9e…"); // ""
 */
export function imageFileName(url: string) {
  if (url.startsWith("blob:") || url.startsWith("data:")) return "";

  const [path = ""] = url.split(/[?#]/);
  const last = path.split("/").at(-1) ?? "";

  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

const SETTLED_MS = 1600;

/**
 * Copies a picture from a button's click, and has the button say how it went for a moment.
 *
 * The button carries `data-state="copying"` while the original is fetched,
 * then `"copied"` or `"failed"` until it settles back. A click while it is
 * busy is ignored.
 *
 * @example button.onclick = () => copyFromButton(button, "/img/docs/a.png");
 */
export async function copyFromButton(button: HTMLElement, url: string) {
  if (button.dataset.state) return;

  button.dataset.state = "copying";
  const state = await copyImage(url).then(
    () => "copied",
    () => "failed",
  );

  button.dataset.state = state;
  button.title = state === "copied" ? "Copied" : "Could not copy the image";
  setTimeout(() => {
    delete button.dataset.state;
    button.title = "Copy image";
  }, SETTLED_MS);
}
