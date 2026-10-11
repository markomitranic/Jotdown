import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The GitHub organisation a folder's git `origin` belongs to, read from its git config without running git.
 *
 * A worktree's `.git` is a file naming its folder inside the main repository,
 * and the config sits in the main repository's own `.git`. Null for a folder
 * outside git, with no `origin`, or with an `origin` that is not on GitHub.
 *
 * @example originOwner("/Users/ada/Sites/web"); // "you"
 */
export function originOwner(folder: string) {
  return /github\.com[:/]([A-Za-z0-9][A-Za-z0-9-]*)\//.exec(originUrl(folder))?.[1] ?? null;
}

/**
 * The GitHub repository a folder's git `origin` points at, as `owner/repo`, or null when it is not on GitHub.
 *
 * @example originRepository("/Users/ada/Sites/web"); // "you/web"
 */
export function originRepository(folder: string) {
  const found = /github\.com[:/]([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(originUrl(folder));
  return found ? `${found[1]}/${found[2]}` : null;
}

function originUrl(folder: string) {
  return /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(readGitConfig(folder) ?? "")?.[1] ?? "";
}

function readGitConfig(folder: string) {
  try {
    const dotGit = join(folder, ".git");
    if (statSync(dotGit).isDirectory()) return readFileSync(join(dotGit, "config"), "utf8");

    const gitDir = resolve(
      folder,
      readFileSync(dotGit, "utf8")
        .replace(/^gitdir:\s*/, "")
        .trim(),
    );
    const common = resolve(gitDir, readText(join(gitDir, "commondir")) ?? ".");
    return readFileSync(join(common, "config"), "utf8");
  } catch {
    return null;
  }
}

function readText(path: string) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}
