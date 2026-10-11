import { readdir, readFile, realpath } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { uploadFile, uploadFolder, uploadType } from "@jotdown/core/server/uploads";
import { publication } from "./project";

/** The folders an upload address may start with, each served by its own route. */
type UploadRoot = "uploads" | "img" | "files" | "whiteboards";

/**
 * The one file written for an upload folder that has none, since a static
 * export refuses a route that writes no file at all.
 */
const NOTHING = "_none";

/**
 * The route for one upload folder: every file under it, written at build time and answered from the project.
 *
 * Every address is a file of the project's uploads folder, which is where pages
 * link `/img/docs/…` and the rest.
 *
 * @example export const { GET, generateStaticParams } = uploadRoute("img");
 */
export function uploadRoute(root: UploadRoot) {
  async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
    const path = (await context.params).path;
    if (path.join("/") === NOTHING) return new Response("");
    const address = [root, ...path].join("/");
    const project = publication();
    const directory = await realpath(project.directory);

    const file = await realpath(join(directory, uploadFile(address, project.config.uploads))).catch(() => null);
    if (!file?.startsWith(directory + sep)) return new Response(null, { status: 404 });

    return new Response(await readFile(file), {
      headers: {
        "content-type": uploadType(address),
        "content-security-policy": "sandbox",
        "x-content-type-options": "nosniff",
      },
    });
  }

  async function generateStaticParams() {
    const { directory, config } = publication();
    const folder = join(directory, uploadFolder(root, config.uploads));
    const entries = await readdir(folder, { recursive: true, withFileTypes: true }).catch(() => []);

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ path: relative(folder, join(entry.parentPath, entry.name)).split(sep) }));
    return files.length ? files : [{ path: [NOTHING] }];
  }

  return { GET, generateStaticParams };
}
