import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { BrokenFile, readJsonFile } from "@jotdown/core/lib/broken-file";
import { CONFIG_FILE, projectConfigSchema } from "@jotdown/core/lib/config";

export { CONFIG_FILE, projectConfigSchema, type ProjectConfig } from "@jotdown/core/lib/config";

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
