/**
 * Deletes tracked images, attachments and whiteboards that no file references.
 *
 * The editor commits every dropped image and attachment under a hash of its
 * own bytes, and nothing removes one when the tag that pointed at it is edited
 * away. This walks every tracked text file, collects the upload URLs it finds,
 * and reports whatever is on disk but in nobody's text.
 *
 * Prints what it would delete and changes nothing. Pass `--delete` to actually
 * remove them, which leaves the deletions staged for you to review and commit.
 *
 * Works on this repository, or on the project folder named first.
 *
 * @example bun run prune-uploads
 * @example bun run prune-uploads ../handbook --delete
 */
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { readProjectConfig } from "@jotdown/core/server/config";

process.chdir(
  resolve(process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? resolve(import.meta.dirname, "..")),
);

const config = readProjectConfig(".");
const inContent = (path: string) => (config.content ? `${config.content}/${path}` : path);

const UPLOAD_DIRS = [
  inContent(`${config.uploads}/img/docs`),
  inContent(`${config.uploads}/files/docs`),
  inContent(`${config.uploads}/whiteboards`),
  inContent("public/img/docs"),
  inContent("public/files/docs"),
  inContent("public/whiteboards"),
];

/**
 * Matches an upload URL wherever it is written.
 *
 * Loose on the way in on purpose: a markdown `![](/img/docs/…)`, a
 * `<FileAttachment href="…">`, a relative `./img/docs/…` and a bare mention in
 * a comment all count as a reference. Missing one means deleting a live file,
 * so the regex would rather say yes.
 */
const REFERENCE = /(?:(?:img|files)\/docs|whiteboards)\/([A-Za-z0-9._-]+)/g;

const uploads = trackedFiles(UPLOAD_DIRS).filter((path) => basename(path) !== ".gitkeep");
const referenced = referencedNames();

const dangling = uploads.filter((path) => !referenced.has(basename(path)));

if (dangling.length === 0) {
  console.log(`Nothing dangling. ${uploads.length} uploads, all referenced.`);
  process.exit(0);
}

const deleting = process.argv.includes("--delete");

console.log(`${dangling.length} of ${uploads.length} uploads are unreferenced${deleting ? "" : " (dry run)"}:`);
for (const path of dangling) console.log(`  ${path}`);

if (!deleting) {
  console.log("\nRun with --delete to remove them.");
  process.exit(0);
}

for (const path of dangling) unlinkSync(path);
execFileSync("git", ["add", "--", ...dangling]);

console.log(`\nDeleted and staged. Review with \`git diff --cached --stat\`.`);

/**
 * Every upload name mentioned by a tracked text file.
 *
 * Reads the repository as git sees it, so the build output and anything
 * ignored stay out of it, and skips the upload folders themselves because no
 * reference lives there and they are where the binaries are.
 */
function referencedNames(): Set<string> {
  const paths = trackedFiles(["."]).filter(
    (path) => !UPLOAD_DIRS.some((dir) => path.startsWith(`${dir}/`)) && isPlainFile(path),
  );

  const names = new Set<string>();

  for (const path of paths) {
    const text = readFileSync(path, "utf8");
    for (const [, name] of text.matchAll(REFERENCE)) if (name) names.add(name);
  }

  return names;
}

/** The files git tracks under the given paths. */
function trackedFiles(paths: string[]): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--", ...paths], { encoding: "utf8" });
  return listed.split("\0").filter(Boolean);
}

/** True for a regular file on disk, false for a symlink such as `.claude/skills` or a deleted path. */
function isPlainFile(path: string) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** @example basename("docs/_uploads/img/docs/a1b2.png"); // "a1b2.png" */
function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
