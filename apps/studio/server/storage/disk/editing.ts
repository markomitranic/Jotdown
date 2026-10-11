import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pageWriteRefusal } from "../../live-edit/_generated";
import type { Corpus } from "../../live-edit/_structure";
import { CONTENT_PATH, META_PATH, type Result } from "../../live-edit/_contract";
import type { Addition, AssetUpload, CommitOutcome, Docs, TreeCommit } from "../types";
import { blobSha, docsFiles, fingerprint, inFolder, readText, removeFile } from "./files";
import type { AssetResponse, SaveRequest, SaveResponse, SourceResponse } from "@jotdown/editor/types";

/**
 * The live-edit operations against a folder on this machine.
 *
 * A save writes the file and stops there: committing is left to whoever owns
 * the folder. `folder` holds `.jotdown/config.json`, and `directory` is the folder
 * its `content` names, which every path here counts from.
 */

/**
 * Reads a page as it is on disk now, with the blob sha a save has to match.
 *
 * @example await readSource(directory, "docs/index.mdx"); // { ok: true, value: { path, text, sha } }
 */
export async function readSource(directory: string, path: string): Promise<Result<SourceResponse>> {
  const text = await readText(directory, path);
  if (text === null) return { ok: false, failure: { status: 404, error: `${path} does not exist in this folder.` } };

  return { ok: true, value: { path, text, sha: blobSha(text) } };
}

/**
 * Every page and `meta.json` under `docs/`, and the fingerprint they were read at.
 *
 * @example await readDocs(folder, directory); // { ok: true, value: { head: "3f1c…", corpus: Map { "docs/index.mdx" => "…" } } }
 */
export async function readDocs(folder: string, directory: string): Promise<Result<Docs>> {
  const corpus: Corpus = new Map();

  for (const path of await docsFiles(directory)) {
    if (!CONTENT_PATH.test(path) && !META_PATH.test(path)) continue;
    corpus.set(path, await readFile(await inFolder(directory, path), "utf8"));
  }

  return { ok: true, value: { head: await fingerprint(folder, directory), corpus } };
}

/**
 * Writes and deletes a batch of files, the way a commit would on GitHub.
 *
 * The head the caller read is not checked. One person edits a folder, and a
 * page's own sha is what `commitFile` checks before it writes.
 */
export async function commitTree(
  folder: string,
  directory: string,
  commit: TreeCommit,
): Promise<Result<CommitOutcome>> {
  await writeAll(directory, commit.additions ?? []);
  for (const path of commit.deletions ?? []) await removeFile(directory, path);

  const written = commit.blobFor ? await readText(directory, commit.blobFor) : null;
  return {
    ok: true,
    value: {
      moved: false,
      commitSha: await fingerprint(folder, directory),
      blobSha: written === null ? null : blobSha(written),
    },
  };
}

/**
 * Saves a page and the drawings it carries, unless the page changed on disk since it was opened.
 *
 * An agent writing the same file while it is open is the case this catches: the
 * sha no longer matches, and the editor is offered a reload instead of writing
 * over what the agent wrote.
 */
export async function commitFile(
  folder: string,
  directory: string,
  save: SaveRequest,
  additions: Addition[] = [],
): Promise<Result<SaveResponse>> {
  const current = await readSource(directory, save.path);
  if (!current.ok) return current;

  const refusal = pageWriteRefusal(save.path, current.value.text);
  if (refusal) return { ok: false, failure: { status: 403, error: refusal } };

  if (current.value.sha !== save.sha) {
    return {
      ok: false,
      failure: {
        status: 409,
        error: "This file changed on disk since you opened it.",
        conflict: { theirs: current.value.sha, ours: save.sha },
      },
    };
  }

  await writeAll(directory, [...additions, { path: save.path, content: save.text }]);
  return { ok: true, value: { commitSha: await fingerprint(folder, directory), sha: blobSha(save.text) } };
}

/**
 * Writes an upload, whose name is a hash of its bytes, so one already there is this very file.
 *
 * @example await commitAsset(directory, asset); // { ok: true, value: { path: "docs/_uploads/img/docs/ab12.png", url: "/img/docs/ab12.png" } }
 */
export async function commitAsset(directory: string, asset: AssetUpload): Promise<Result<AssetResponse>> {
  const target = await inFolder(directory, asset.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, asset.bytes, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });

  return { ok: true, value: { path: asset.path, url: asset.url } };
}

async function writeAll(directory: string, additions: Addition[]) {
  for (const { path, content } of additions) {
    const target = await inFolder(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}
