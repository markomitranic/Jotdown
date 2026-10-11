import { z } from "zod";

export const MAX_WHITEBOARD_BYTES = 3_000_000;
export const WHITEBOARD_EVENT = "live-edit:whiteboard";

/** Saved asset references, plus self-contained scene data while a draft is pending. */
export type WhiteboardData = { src: string; preview: string; scene: string };

export type WhiteboardRequest = {
  data: WhiteboardData;
  write(data: WhiteboardData): void;
  alive(): boolean;
};

const sceneSchema = z
  .object({
    type: z.literal("excalidraw"),
    version: z.number(),
    elements: z.array(z.object({ id: z.string(), type: z.string() }).passthrough()),
    appState: z.record(z.string(), z.unknown()).optional(),
    files: z
      .record(
        z.string(),
        z
          .object({
            id: z.string(),
            mimeType: z.string(),
            dataURL: z.string().startsWith("data:"),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

/** Validates an editable Excalidraw file without loading the drawing library.
 * @example readScene('{"type":"excalidraw","version":2,"elements":[]}').elements; // []
 */
export function readScene(text: string) {
  return sceneSchema.parse(JSON.parse(text));
}

/** Escapes an attribute so JSON and image data survive a Markdown draft round trip.
 * @example whiteboardMarkdown({ src: "", preview: "", scene: "" }); // "<Whiteboard />"
 */
export function whiteboardMarkdown(data: WhiteboardData) {
  const attrs = Object.entries(data)
    .filter(([, value]) => value !== "")
    .map(([name, value]) => ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join("");
  return `<Whiteboard${attrs} />`;
}

/** Reads only the whiteboard fields from a node's attribute map.
 * @example whiteboardData({ src: "/whiteboards/a.excalidraw" }).scene; // ""
 */
export function whiteboardData(attrs: Record<string, unknown> = {}): WhiteboardData {
  return {
    src: typeof attrs.src === "string" ? attrs.src : "",
    preview: typeof attrs.preview === "string" ? attrs.preview : "",
    scene: typeof attrs.scene === "string" ? attrs.scene : "",
  };
}
