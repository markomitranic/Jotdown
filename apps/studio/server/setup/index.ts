import { parseProjectKey } from "../../lib/project-key";
import type {
  ContentState,
  Destination,
  Inspection,
  SetupAnswers,
  SetupDone,
  SetupPlan,
  SetupTarget,
} from "../../lib/setup";
import type { Session } from "../auth/session";
import { addFolder, expandHome } from "../storage/disk/folders";
import { forgetProject } from "../storage/github/projects";
import { asideMoves, classify } from "./content";
import * as disk from "./disk";
import { readDeployment, readSkills } from "./framework";
import * as github from "./github";
import { changes, planSetup, plannedFolders, plannedPaths, summarise } from "./plan";

/**
 * The setup wizard's server: looking at a target, planning what to write there, and writing it.
 *
 * A GitHub repository gets one commit, straight onto the default branch, which
 * is the one the studio reads. A folder gets the files written in place and is
 * bookmarked, so it opens before anything is committed.
 */

/** A setup the server refuses, with the status to answer. */
export class SetupRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * What a target holds before setup, and whether it can be set up.
 *
 * @example await inspect({ kind: "github", key: "you/site" }, session); // { name: "you/site", problem: null, … }
 */
export async function inspect(target: SetupTarget, session: Session): Promise<Inspection> {
  if (target.kind === "folder") return disk.inspectFolder(target.path);

  const key = parseProjectKey(target.key);
  if (!key) throw new SetupRefused("Name the repository as owner/repo.", 400);
  if (!session.token)
    throw new SetupRefused(
      "Sign in to GitHub with `gh auth login`, then start the studio again, to set up a GitHub repository.",
      401,
    );
  return github.inspectRepository(key, session);
}

/**
 * What the content folder a setup would use already holds: nothing in the way, or files that are.
 *
 * @example await inspectContent({ kind: "github", key: "you/site" }, "docs", session); // { kind: "clear" }
 */
export async function inspectContent(target: SetupTarget, content: string, session: Session): Promise<ContentState> {
  return classify(await readHolding(target, content, session), content === "");
}

/** What the planned paths already hold, and which of their folders are files instead, read from the repository or the folder the target names. */
function readExisting(target: SetupTarget, session: Session, paths: string[], folders: string[]) {
  if (target.kind === "folder") return disk.readExisting(target.path, paths, folders);
  const key = parseProjectKey(target.key);
  if (!key) throw new SetupRefused("Name the repository as owner/repo.", 400);
  return github.readExisting(key, session, paths, folders);
}

/** What the content folder holds, read from the repository or the folder the target names. */
function readHolding(target: SetupTarget, content: string, session: Session) {
  if (target.kind === "folder") return disk.readHolding(expandHome(target.path), content);
  const key = parseProjectKey(target.key);
  if (!key) throw new SetupRefused("Name the repository as owner/repo.", 400);
  return github.readHolding(key, session, content);
}

/**
 * The files a setup would write and where, without writing any.
 *
 * @example await planFor(answers, session); // { files: [{ path: ".jotdown/config.json", change: "new" }, …], destination: { kind: "github", branch: "main", editor: "ada" } }
 */
export async function planFor(answers: SetupAnswers, session: Session): Promise<SetupPlan> {
  const { inspection, writes } = await prepare(answers, session);
  return { files: summarise(writes), destination: destination(inspection, session) };
}

/**
 * Writes the project: one commit to a repository, or the files into a folder, which is bookmarked.
 *
 * @example await setUp(answers, session); // { key: "you/site", title: "Web", files: […] }
 */
export async function setUp(answers: SetupAnswers, session: Session): Promise<SetupDone> {
  const { inspection, writes } = await prepare(answers, session);
  const written = changes(writes);

  if (inspection.target.kind === "folder") {
    await disk.writeSetup(inspection.target.path, written);
    const folder = await addFolder(inspection.target.path);
    return { key: folder.key, title: answers.title, files: summarise(writes) };
  }

  const key = parseProjectKey(inspection.target.key);
  if (!key || !inspection.branch) throw new SetupRefused("The repository has no default branch.", 409);
  await github.commitSetup(key, inspection.branch, written, session);
  forgetProject(key);
  return { key: inspection.target.key, title: answers.title, files: summarise(writes) };
}

/** Looks at the target again, reads what the plan needs, and plans against what the target holds now. */
async function prepare(answers: SetupAnswers, session: Session) {
  const inspection = await inspect(answers.target, session);
  if (inspection.problem) throw new SetupRefused(inspection.problem.message, 409);

  const holding = await readHolding(answers.target, answers.content, session);
  if (!answers.moveOld && classify(holding, answers.content === "").kind === "occupied") {
    throw new SetupRefused(
      "The content folder already holds files. Move them into _old/, or pick another folder.",
      409,
    );
  }
  const moves = asideMoves(answers.content, holding, answers.moveOld);

  const [skills, deployment] = await Promise.all([
    answers.skills ? readSkills() : [],
    answers.publishing === "none" ? [] : readDeployment(answers.publishing),
  ]);
  const framework = { skills, deployment, icon: iconBytes(answers.icon), moves };

  const paths = plannedPaths(answers, inspection, framework);
  const folders = plannedFolders([...paths, ...moves.map((move) => move.to)]);
  const found = await readExisting(inspection.target, session, paths, folders);

  return { inspection, writes: planSetup(answers, inspection, { ...framework, ...found }) };
}

/**
 * The icon's bytes, refusing anything but a PNG, which is what the wizard draws every icon into.
 *
 * @example iconBytes("iVBORw0KGgo…"); // Uint8Array
 */
function iconBytes(base64: string | null) {
  if (!base64) return null;

  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  const png = [0x89, 0x50, 0x4e, 0x47].every((byte, index) => bytes[index] === byte);
  if (!png) throw new SetupRefused("The icon is not a PNG image.", 400);
  return bytes;
}

/**
 * Where the files land, for the review step to say.
 *
 * @example destination(inspection, session); // { kind: "github", branch: "main", editor: "ada" }
 */
function destination(inspection: Inspection, session: Session): Destination {
  if (inspection.target.kind === "folder") return { kind: "folder", name: inspection.name };
  return { kind: "github", branch: inspection.branch ?? "main", editor: session.editor.login };
}
