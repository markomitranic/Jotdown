/**
 * Links every file of `.agents/skills/` into `.claude/skills/`, where Claude Code looks for skills.
 *
 * One symlink per file rather than one for the folder, because pnpm 12 cannot
 * install a git repository holding a symlink to a folder. Run it again after adding, moving or deleting a
 * skill's file; it rebuilds `.claude/skills/` from scratch.
 *
 * @example bun scripts/link-skills.ts
 */

import { lstat, mkdir, readdir, rm, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = join(ROOT, ".agents/skills");
const TARGET = join(ROOT, ".claude/skills");

await rm(TARGET, { recursive: true, force: true });

const files = (await readdir(SOURCE, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(SOURCE, join(entry.parentPath, entry.name)))
  .sort();

for (const file of files) {
  const link = join(TARGET, file);
  await mkdir(dirname(link), { recursive: true });
  await symlink(relative(dirname(link), join(SOURCE, file)), link);
}

const linked = await Promise.all(files.map((file) => lstat(join(TARGET, file))));
console.log(`Linked ${linked.filter((info) => info.isSymbolicLink()).length} skill files into .claude/skills.`);
