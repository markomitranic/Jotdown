import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { projectSource } from "@jotdown/core/server/content";
import { formatProjectKey, type ProjectKey } from "../../lib/project-key";
import type { Session } from "../auth/session";
import { ProjectUnavailable, storage } from "../storage";
import { folderAt } from "../storage/disk/folders";

/** Where VS Code's own command line sits inside the app, wherever the app was put. */
const CLI = "Contents/Resources/app/bin/code";
const APPS = ["/Applications", join(homedir(), "Applications")];

/**
 * Opens a folder project in VS Code, and the page at a slug inside it.
 *
 * The folder opens as VS Code's workspace, or comes forward when a window has
 * it already, and the page's file opens in it. A slug no page lives at opens
 * the folder alone.
 *
 * @example await openInEditor(parseProjectKey("local/notes")!, session, ["guides", "setup"]);
 */
export async function openInEditor(key: ProjectKey, session: Session, slug: string[]) {
  const folder = await folderAt(formatProjectKey(key));
  if (!folder) throw new ProjectUnavailable("Only a folder on this machine opens in VS Code.", 404);

  const code = APPS.map((apps) => join(apps, "Visual Studio Code.app", CLI)).find((cli) => existsSync(cli));
  if (!code) throw new ProjectUnavailable("VS Code is not in Applications.", 404);

  const project = await storage.openProject(key, session);
  const page = (await projectSource(project)).getPage(slug);
  const file = page ? [join(project.directory, DOCS_ROOT, page.path)] : [];

  spawn(code, [folder.path, ...file], { detached: true, stdio: "ignore" }).unref();
}
