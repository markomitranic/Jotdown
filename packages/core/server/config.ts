import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { themeSchema } from "@jotdown/core/lib/theme";
import { BrokenFile, readJsonFile } from "@jotdown/core/lib/broken-file";
import { DOCS_ROOT, UPLOADS_FOLDER } from "@jotdown/core/lib/paths";

const uploadUrl = z
  .string()
  .regex(/^\/(?:uploads|img|files|whiteboards)\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/);
const folderPath = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/);
const uploadsFolder = z
  .string()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/)
  .refine(
    (path) => path.split("/")[0] !== DOCS_ROOT || path.split("/").some((segment) => segment.startsWith("_")),
    `Uploads under ${DOCS_ROOT}/ go in a folder whose name starts with _, since every other folder there holds pages.`,
  );

/** Where a project's config is, from the repository root: the one file every Jotdown project has, in the one folder that is Jotdown's. */
export const CONFIG_FILE = ".jotdown/config.json";

/** The shape of `.jotdown/config.json`, plain data so nothing in a project runs code. */
export const projectConfigSchema = z.object({
  version: z.literal(1).default(1),
  jotdown: z.string().min(1).optional(),
  content: folderPath.optional(),
  uploads: uploadsFolder.default(UPLOADS_FOLDER),
  title: z.string().min(1).default("Documentation"),
  description: z.string().default(""),
  repository: z.string().url().optional(),
  url: z.string().url().optional(),
  branch: z.string().min(1).optional(),
  theme: themeSchema.optional(),
  logo: z.object({ alt: z.string(), src: uploadUrl, srcDark: uploadUrl.optional() }).optional(),
  favicon: uploadUrl.optional(),
  /** The layout a page is drawn in when its front matter names none. */
  layout: z.string().min(1).default("docs"),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/**
 * Parses a project's `.jotdown/config.json` text, or the defaults when it has none.
 *
 * A config that is not JSON or breaks the schema throws a `BrokenFile` naming it.
 *
 * @example parseProjectConfig(null, "handbook").title; // "handbook"
 */
export function parseProjectConfig(text: string | null, fallbackTitle: string) {
  if (text === null) return projectConfigSchema.parse({ title: fallbackTitle });

  const config = readJsonFile(projectConfigSchema, text);
  if (!config.ok) throw new BrokenFile(CONFIG_FILE, config.problem);
  return config.data;
}

/** Reads a repository's settings from disk, refusing a symlinked config file. */
export function readProjectConfig(repository: string) {
  const file = join(repository, CONFIG_FILE);
  if (!existsSync(file)) return parseProjectConfig(null, basename(repository));
  if (lstatSync(file).isSymbolicLink()) throw new Error("Project configuration cannot be a symbolic link.");
  return parseProjectConfig(readFileSync(file, "utf8"), basename(repository));
}

/**
 * The folder holding a repository's `docs/`: its `content`, or the repository itself.
 *
 * @example contentDirectory("/work/web"); // "/work/web/apps/docs"
 */
export function contentDirectory(repository: string) {
  return join(repository, readProjectConfig(repository).content ?? "");
}
