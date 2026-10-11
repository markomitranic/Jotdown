import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import type { Inspection, SetupTarget } from "../../lib/setup";
import { CONFIG_FILE } from "@jotdown/core/server/config";
import { inFolder } from "../storage/disk/files";
import { expandHome, homeRelative } from "../storage/disk/folders";
import { agentFileOf } from "./github";
import type { Write } from "./plan";
import { suggestedTitle } from "./suggest";

/**
 * Setting up a folder on this machine: what it holds before, and writing the files in place.
 *
 * Nothing is committed. The folder's git, if it has one, sees the moves and the
 * new files like any others, and the developer commits them
 * when they have read them.
 */

const run = promisify(execFile);

/**
 * What a folder holds before setup, its GitHub address and default branch when git knows them.
 *
 * @example await inspectFolder("~/Sites/web"); // { name: "~/Sites/web", repository: "https://github.com/you/site", branch: "main", problem: null, … }
 */
export async function inspectFolder(raw: string): Promise<Inspection> {
  const path = expandHome(raw);
  const target: SetupTarget = { kind: "folder", path };
  const name = homeRelative(path);

  const info = await stat(path).catch(() => null);
  const blank = {
    target,
    name,
    title: suggestedTitle(basename(path)),
    description: "",
    branch: null,
    repository: null,
    agentFile: null,
  } satisfies Omit<Inspection, "problem">;
  if (!info?.isDirectory())
    return { ...blank, problem: { kind: "unreachable", message: `${name} is not a folder on this machine.` } };

  const root = await readdir(path).catch((): string[] => []);
  const found = {
    ...blank,
    description: await packageDescription(path),
    branch: await defaultBranch(path),
    repository: await remoteUrl(path),
    agentFile: agentFileOf(root),
  };

  if (existsSync(join(path, CONFIG_FILE)))
    return { ...found, problem: { kind: "configured", message: `${name} is a Jotdown project already.`, open: "" } };
  return { ...found, problem: null };
}

/**
 * Which of some paths exist in the folder, the text of the agent instructions files among them, and which of some folders are files or links instead.
 *
 * @example await readExisting("/Users/ada/Sites/web", ["AGENTS.md"], [".agents/skills/blocks"]); // { existing: Set { "AGENTS.md" }, notes: { "AGENTS.md": "…" }, standing: Set { ".agents/skills/blocks" } }
 */
export async function readExisting(folder: string, paths: string[], folders: string[]) {
  const existing = new Set(paths.filter((path) => existsSync(join(folder, path))));
  const notes: Partial<Record<"AGENTS.md" | "CLAUDE.md", string>> = {};

  for (const file of ["AGENTS.md", "CLAUDE.md"] as const) {
    if (existing.has(file)) notes[file] = await readFile(join(folder, file), "utf8");
  }

  const standing = new Set<string>();
  for (const path of folders) {
    const found = await lstat(join(folder, path)).catch(() => null);
    if (found && !found.isDirectory()) standing.add(path);
  }
  return { existing, notes, standing };
}

/**
 * The names of what the content folder holds on disk, or none when it is not there.
 *
 * @example await readHolding("/Users/ada/Sites/web", "apps/docs"); // ["app", "docs", "package.json"]
 */
export async function readHolding(folder: string, content: string) {
  return readdir(join(folder, content)).catch((): string[] => []);
}

/**
 * Moves and deletes what the content folder held, then writes every file into the folder, each link as a symlink.
 *
 * A move is a rename, so nothing is copied, and the folders it leaves empty go
 * with the deletions that name them. A link that is there already is replaced.
 *
 * @example await writeSetup("/Users/ada/Sites/web", writes);
 */
export async function writeSetup(folder: string, writes: Write[]) {
  for (const write of writes) {
    if (!("from" in write)) continue;
    const target = await entryAt(folder, write.path);
    await mkdir(dirname(target), { recursive: true });
    await rename(await entryAt(folder, write.from), target);
  }

  for (const write of writes) {
    if ("remove" in write) await rm(await entryAt(folder, write.path), { recursive: true, force: true });
  }

  for (const write of writes) {
    if (!("content" in write) && !("link" in write)) continue;
    const target = await entryAt(folder, write.path);
    await mkdir(dirname(target), { recursive: true });

    if ("link" in write) {
      if (await lstat(target).catch(() => null)) await rm(target);
      await symlink(write.link, target);
    } else {
      await writeFile(target, write.content);
    }
  }
}

/**
 * Where a project path sits on disk, its folders checked for links on the way and the entry itself taken as it is, a link or not.
 *
 * @example await entryAt("/Users/ada/Sites/web", ".claude/skills"); // "/Users/ada/Sites/web/.claude/skills"
 */
async function entryAt(folder: string, path: string) {
  const parent = dirname(path) === "." ? folder : await inFolder(folder, dirname(path));
  return join(parent, basename(path));
}

/** The description in the folder's `package.json`, or nothing. */
async function packageDescription(path: string) {
  const text = await readFile(join(path, "package.json"), "utf8").catch(() => "{}");
  try {
    const description: unknown = JSON.parse(text).description;
    return typeof description === "string" ? description : "";
  } catch {
    return "";
  }
}

/**
 * The branch `origin` names as its default, else the branch checked out, or null outside git.
 *
 * @example await defaultBranch("/Users/ada/Sites/web"); // "main"
 */
async function defaultBranch(path: string) {
  const remote = await git(path, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (remote) return remote.replace(/^origin\//, "");
  return (await git(path, ["branch", "--show-current"])) || null;
}

/**
 * The folder's `origin` as an address people open, or null when it has none.
 *
 * @example await remoteUrl("/Users/ada/Sites/web"); // "https://github.com/you/site"
 */
async function remoteUrl(path: string) {
  const url = (await git(path, ["remote", "get-url", "origin"]))
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/\.git$/, "");
  return url.startsWith("https://") ? url : null;
}

async function git(path: string, args: string[]) {
  try {
    return (await run("git", args, { cwd: path, timeout: 5_000 })).stdout.trim();
  } catch {
    return "";
  }
}
