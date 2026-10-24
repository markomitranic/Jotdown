import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/**
 * The framework's own files a new project gets a copy of: the docs skills and the publishing files.
 *
 * They are read from this checkout, so a project set up by a studio gets the
 * skills of that studio's own version. The studio runs from `apps/studio`, and
 * the files sit two folders up, at the framework's root. The build is told to
 * leave that path alone, or it copies the whole repository into the server,
 * and lists the files it needs in its config instead.
 */

const ROOT = resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

/** A file to copy: its path from the framework's root, and its text. */
export type FrameworkFile = { path: string; content: string };

/**
 * Every file of every docs skill, by its path under `.agents/skills/`.
 *
 * @example await readSkills(); // [{ path: ".agents/skills/authoring/SKILL.md", content: "---\nname: authoring…" }, …]
 */
export async function readSkills(): Promise<FrameworkFile[]> {
  const folder = join(ROOT, ".agents/skills");
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .sort();

  return Promise.all(paths.map(async (path) => ({ path, content: await readFile(join(ROOT, path), "utf8") })));
}

/**
 * The files a content repository copies to publish on a host, by their path from its root, with the `.gitignore` that keeps the build's leftovers out of git.
 *
 * @example await readDeployment("vercel"); // [{ path: ".jotdown/vercel.json", … }, { path: ".jotdown/.gitignore", … }]
 */
export async function readDeployment(host: "vercel"): Promise<FrameworkFile[]> {
  const folder = join(ROOT, "deployment", host);
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .sort();

  return Promise.all(paths.map(async (path) => ({ path, content: await readFile(join(folder, path), "utf8") })));
}
