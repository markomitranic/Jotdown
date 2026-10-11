import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { formatProjectKey, type ProjectKey } from "../../lib/project-key";
import type { Session } from "../auth/session";
import { ProjectUnavailable } from "../storage";
import { folderAt } from "../storage/disk/folders";
import { keepBranch } from "../storage/favorites";
import { forgetProject, listBranches } from "../storage/github/projects";

const run = promisify(execFile);

/** A project's branches: the one it is read on, the one it would be read on unpicked, and every one there is. */
export type Branches = { current: string; home: string | null; branches: string[] };

/**
 * The branches of a project: GitHub's for a repository, the folder's own git branches for a folder.
 *
 * A folder outside git, or with its HEAD detached, has no branch to show.
 *
 * @example await readBranches(parseProjectKey("local/notes")!, session); // { current: "main", home: null, branches: ["main", "draft"] }
 */
export async function readBranches(key: ProjectKey, session: Session): Promise<Branches> {
  const folder = await localFolder(key);
  if (!folder) return listBranches(key, session.token);

  const [current, listed] = await Promise.all([
    git(folder, "branch", "--show-current"),
    git(folder, "for-each-ref", "--format=%(refname:short)", "refs/heads"),
  ]);
  if (!current) throw new ProjectUnavailable(`${formatProjectKey(key)} is not on a branch.`, 404);
  return { current, home: null, branches: listed.split("\n").filter(Boolean) };
}

/**
 * Moves a project to another branch: the studio reads and commits there from now on, or the folder checks it out.
 *
 * A GitHub project only changes where the studio looks, and its home branch
 * forgets the pick. A folder is switched with git itself, which refuses when
 * the switch would overwrite changes nobody committed, and says so.
 *
 * @example await switchBranch(parseProjectKey("you/notes")!, session, "redesign");
 */
export async function switchBranch(key: ProjectKey, session: Session, branch: string) {
  const folder = await localFolder(key);
  if (folder) return void (await git(folder, "switch", branch));

  const { home, branches } = await listBranches(key, session.token);
  if (!branches.includes(branch))
    throw new ProjectUnavailable(`${formatProjectKey(key)} has no branch ${branch}.`, 404);
  await keepBranch(formatProjectKey(key), branch === home ? null : branch);
  forgetProject(key);
}

/** The folder on this machine a `local/` key names, or null for a GitHub project. */
async function localFolder(key: ProjectKey) {
  if (key.owner.toLowerCase() !== "local") return null;
  const folder = await folderAt(formatProjectKey(key));
  if (!folder)
    throw new ProjectUnavailable(`No folder on this machine is bookmarked as ${formatProjectKey(key)}.`, 404);
  return folder.path;
}

/**
 * Runs git in a folder, answering what it printed, or throwing what it said went wrong.
 *
 * @example await git("/Users/ada/notes", "branch", "--show-current"); // "main"
 */
async function git(folder: string, ...args: string[]) {
  try {
    const { stdout } = await run("git", ["-C", folder, ...args], { timeout: 15_000 });
    return stdout.trim();
  } catch (error) {
    const said = (error as { stderr?: string }).stderr
      ?.trim()
      .split("\n")[0]
      ?.replace(/^(error|fatal): /, "");
    throw new ProjectUnavailable(said || "git could not be run in the project's folder.", 409);
  }
}
