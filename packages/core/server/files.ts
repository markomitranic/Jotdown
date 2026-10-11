import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Lists a content directory while rejecting symlinks that could expose files outside the project. */
export async function contentFiles(directory: string) {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error("Content folders cannot be symbolic links.");
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw new Error(`Content cannot contain symbolic links: ${join(entry.parentPath, entry.name)}`);
  }
  return entries.filter((entry) => entry.isFile());
}
