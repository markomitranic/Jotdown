import { z } from "zod";
import { webAddress } from "@jotdown/core/lib/web-address";
import { formatProjectKey, type ProjectKey } from "../../lib/project-key";
import type { Session } from "../auth/session";
import { errorResponse, readJsonBody } from "../live-edit/_contract";
import { readBranches } from "../projects/branches";
import { storage } from "../storage";
import { folderAt } from "../storage/disk/folders";
import { originRepository } from "../storage/disk/origin";

/**
 * Whether the addresses a config names answer: its repository, its branch, its site and the files it points at.
 *
 * The panel asks about the draft rather than the saved file, so a URL typed a
 * moment ago is checked before anybody commits it.
 */

const TIMEOUT_MS = 6000;

/** How one check came out, and the value that would fix it when there is one. */
export type HealthCheck = {
  id: "repository" | "branch" | "url" | "files";
  state: "ok" | "warning" | "failed";
  text: string;
  fix?: { field: "repository"; value: string };
};

const askSchema = z.object({
  repository: z.string().optional(),
  url: z.string().optional(),
  branch: z.string().optional(),
  files: z
    .array(z.string().regex(/^\/[A-Za-z0-9_/.-]+$/))
    .max(8)
    .default([]),
});

/** `POST settings/health` with the draft's addresses: every check, side by side. */
export async function checkHealth(request: Request, key: ProjectKey, session: Session) {
  const asked = askSchema.safeParse(await readJsonBody(request));
  if (!asked.success) return errorResponse({ status: 400, error: "Expected the config's addresses." });
  const { repository, url, branch, files } = asked.data;

  const checks = await Promise.all([
    checkRepository(key, repository),
    checkBranch(key, session, branch),
    checkSite(url),
    checkFiles(key, session, files),
  ]);
  return Response.json(
    checks.filter((check) => check !== null),
    { headers: { "cache-control": "no-store" } },
  );
}

/** The repository the project really is: its key on GitHub, or a folder's git origin. */
async function actualRepository(key: ProjectKey) {
  if (key.owner.toLowerCase() !== "local") return formatProjectKey(key);
  const folder = await folderAt(formatProjectKey(key));
  return folder ? originRepository(folder.path) : null;
}

async function checkRepository(key: ProjectKey, repository: string | undefined): Promise<HealthCheck | null> {
  const actual = await actualRepository(key);
  if (!actual) return null;

  const expected = `https://github.com/${actual}`;
  if (!repository) {
    return {
      id: "repository",
      state: "warning",
      text: `Not set. This project is ${actual}.`,
      fix: { field: "repository", value: expected },
    };
  }

  const named = /github\.com\/([^/]+\/[^/#?]+?)(?:\.git)?\/?$/.exec(repository)?.[1];
  if (named?.toLowerCase() === actual.toLowerCase())
    return { id: "repository", state: "ok", text: `Matches ${actual}.` };
  return {
    id: "repository",
    state: "failed",
    text: `Names ${named ?? repository}, but this project is ${actual}.`,
    fix: { field: "repository", value: expected },
  };
}

async function checkBranch(key: ProjectKey, session: Session, branch: string | undefined): Promise<HealthCheck> {
  const listed = await readBranches(key, session).catch(() => null);
  if (!listed) return { id: "branch", state: "warning", text: "The branches could not be read." };
  if (!branch)
    return { id: "branch", state: "ok", text: `Follows the default branch, ${listed.home ?? listed.current}.` };

  return listed.branches.includes(branch)
    ? { id: "branch", state: "ok", text: `${branch} exists.` }
    : { id: "branch", state: "failed", text: `There is no branch called ${branch}.` };
}

async function checkSite(url: string | undefined): Promise<HealthCheck> {
  if (!url) return { id: "url", state: "warning", text: "No site address yet. Links to the published site stay off." };
  if (!webAddress(url)) return { id: "url", state: "failed", text: "The site address has to start with https://." };

  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    await response.body?.cancel();
    return response.ok
      ? { id: "url", state: "ok", text: `${new URL(url).host} answers.` }
      : { id: "url", state: "failed", text: `${new URL(url).host} answers ${response.status}.` };
  } catch {
    return { id: "url", state: "failed", text: "The site does not answer." };
  }
}

async function checkFiles(key: ProjectKey, session: Session, files: string[]): Promise<HealthCheck | null> {
  if (files.length === 0) return null;

  const found = await Promise.all(
    files.map(async (file) => ({
      file,
      there: (await storage.readUpload(key, session, file).catch(() => null)) !== null,
    })),
  );
  const missing = found.filter(({ there }) => !there).map(({ file }) => file);

  return missing.length === 0
    ? {
        id: "files",
        state: "ok",
        text: files.length === 1 ? "The file it names is there." : `All ${files.length} files it names are there.`,
      }
    : { id: "files", state: "failed", text: `Missing ${missing.join(", ")}.` };
}
