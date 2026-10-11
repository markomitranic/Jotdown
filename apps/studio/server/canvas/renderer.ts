import { cache } from "react";
import { CANVAS_PATH } from "@jotdown/core/lib/canvas";
import type { StudioProject } from "@/server/storage";
import { chosenRenderer, type Renderer } from "@/server/storage/favorites";

/** How the open project is drawn, the canvas's address when a canvas at a known address draws it, and whether it is a folder. */
export type Drawing = { renderer: Renderer; canvas: string | null; siteUrl: string | null; folder: boolean };

/**
 * How a project is drawn: the way last chosen for it, or through its site when the config names one, or by the studio.
 *
 * A site's canvas lives at `<url>/_edit`. A custom address is taken as it
 * was typed, since a dev server can serve its canvas wherever it likes. A
 * folder's own dev server has no address until the studio has started it.
 *
 * @example await drawingOf(project); // { renderer: { mode: "site" }, canvas: "https://notes.example.com/_edit", siteUrl: "https://notes.example.com", folder: false }
 */
export const drawingOf = cache(async (project: StudioProject): Promise<Drawing> => {
  const siteUrl = project.config.url?.replace(/\/+$/, "") ?? null;
  const folder = project.key.startsWith("local/");
  const chosen = await chosenRenderer(project.key);
  const renderer: Renderer = chosen ?? (siteUrl ? { mode: "site" } : { mode: "skinny" });

  if (renderer.mode === "custom") return { renderer, canvas: renderer.url, siteUrl, folder };
  if (renderer.mode === "dev" && folder) return { renderer, canvas: null, siteUrl, folder };
  if (renderer.mode === "site" && siteUrl) return { renderer, canvas: `${siteUrl}${CANVAS_PATH}`, siteUrl, folder };
  return { renderer: { mode: "skinny" }, canvas: null, siteUrl, folder };
});
