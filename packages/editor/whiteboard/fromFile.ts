/**
 * An `.excalidraw` file from the desktop, turned into a whiteboard waiting on the page's Save.
 *
 * A drawing on the page is its scene and a PNG of it, and both ride in the
 * draft until Save commits them together. A dropped file is the scene already,
 * so all that is left is drawing the picture, which needs the drawing library.
 * It is loaded here, on the drop, rather than with the editor.
 */

import { MAX_WHITEBOARD_BYTES, readScene } from "@jotdown/core/components/blocks/whiteboard/model";

/**
 * The whiteboard block a dropped drawing becomes, or why it cannot become one.
 *
 * @example await whiteboardFromFile(file); // { ok: true, node: { type: "whiteboard", … } }
 */
export async function whiteboardFromFile(file: File) {
  const scene = await file.text();

  try {
    readScene(scene);
  } catch {
    return { ok: false as const, error: `${file.name} is not an Excalidraw drawing.` };
  }

  const preview = await previewOf(scene).catch(() => null);
  if (preview === null) {
    return { ok: false as const, error: `${file.name} could not be drawn. Open it in Excalidraw and save it again.` };
  }

  if (new TextEncoder().encode(scene + preview).byteLength > MAX_WHITEBOARD_BYTES) {
    return {
      ok: false as const,
      error: `${file.name} is too large. Keep the drawing and its images under 3 MB.`,
    };
  }

  return {
    ok: true as const,
    node: { type: "whiteboard", attrs: { src: "", preview, scene } },
  };
}

/** The drawing as the PNG a page shows until somebody opens it, as a data URL. */
async function previewOf(scene: string) {
  const { exportToBlob, loadFromBlob } = await import("@excalidraw/excalidraw");
  const restored = await loadFromBlob(new Blob([scene], { type: "application/json" }), null, null);
  const picture = await exportToBlob({
    elements: restored.elements,
    files: restored.files,
    appState: {
      ...restored.appState,
      exportBackground: true,
      exportWithDarkMode: false,
      exportEmbedScene: false,
    },
    mimeType: "image/png",
    maxWidthOrHeight: 1600,
  });

  return dataUrl(picture);
}

/**
 * A picture as a data URL, which survives the draft being recovered after a reload.
 *
 * @example await dataUrl(blob); // "data:image/png;base64,…"
 */
export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read preview."));
    reader.onerror = () => reject(new Error("Could not read preview."));
    reader.readAsDataURL(blob);
  });
}
