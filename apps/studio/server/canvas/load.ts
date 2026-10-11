import type { CanvasLoad } from "@jotdown/core/lib/canvas";
import { projectSource } from "@jotdown/core/server/content";
import { serializeTree } from "@jotdown/core/lib/serial-tree";
import { liveEditConfig } from "@/lib/live-edit/config";
import { pageTarget } from "@/lib/page-target";
import type { ProjectKey } from "@/lib/project-key";
import { localSession } from "@/server/auth/session";
import { storage } from "@/server/storage";

/**
 * Everything a canvas needs to draw one page of a project: its text, the tree around it and the editor's settings.
 *
 * Read the way the studio reads a page for itself, so the canvas edits the
 * same file, at the same version, that the studio would. Nothing comes back
 * for an address no page lives at.
 *
 * @example await canvasLoad({ owner: "you", repo: "notes" }, ["guides", "setup"]); // { type: "load", url: "/you/notes/guides/setup", … }
 */
export async function canvasLoad(key: ProjectKey, slug: string[]): Promise<CanvasLoad | null> {
  const session = await localSession();
  const project = await storage.openProject(key, session);
  const source = await projectSource(project);
  const page = source.getPage(slug);
  if (!page) return null;

  const target = pageTarget(project, page);
  return {
    type: "load",
    url: page.url,
    path: target.path,
    text: await page.data.getText("raw"),
    tree: serializeTree(source.getPageTree()),
    config: liveEditConfig(project, session, source),
    target,
  };
}
