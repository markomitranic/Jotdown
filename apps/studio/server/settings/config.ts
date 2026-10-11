import { projectConfigSchema } from "@jotdown/core/server/config";
import type { Session } from "../auth/session";
import { errorResponse, readJsonBody, type Result, type Unparsed } from "../live-edit/_contract";
import { parseHistory, parseRevision } from "../live-edit/_history";
import { storage } from "../storage";

/**
 * The project's `.jotdown/config.json` as the settings panel reads, saves and looks back through it.
 *
 * Every answer is the file's own text, never a parsed copy, so a save writes
 * back exactly the keys somebody set, in the order they were written.
 */

const NO_STORE = { "cache-control": "private, no-store" };

/** `GET settings/config`: the config's text and the blob sha a save has to match. */
export async function readConfig() {
  const config = await storage.readConfig();
  return config.ok ? Response.json(config.value, { headers: NO_STORE }) : errorResponse(config.failure);
}

/**
 * `POST settings/config` with `{ text, sha, message }`: commits the config as the signed-in editor.
 *
 * The text is checked against the same schema the project loader reads it with,
 * so a config the panel saves is one every renderer will open.
 */
export async function saveConfig(request: Request, session: Session) {
  const save = parseSave(await readJsonBody(request));
  if (!save.ok) return errorResponse(save.failure);

  const saved = await storage.saveConfig({ ...save.value, author: session.editor });
  return saved.ok ? Response.json(saved.value, { headers: NO_STORE }) : errorResponse(saved.failure);
}

/** `GET settings/history?page=&head=`: the config's commits, newest first. */
export async function listHistory(request: Request) {
  const pagination = parseHistory(new URL(request.url).searchParams);
  if (!pagination.ok) return errorResponse(pagination.failure);

  const history = await storage.listConfigHistory(pagination.value.page, pagination.value.head);
  return history.ok ? Response.json(history.value, { headers: NO_STORE }) : errorResponse(history.failure);
}

/** `GET settings/revision?sha=`: the config's text at one commit. */
export async function readRevision(request: Request) {
  const sha = parseRevision(new URL(request.url).searchParams.get("sha"));
  if (!sha.ok) return errorResponse(sha.failure);

  const revision = await storage.readConfigRevision(sha.value);
  return revision.ok ? Response.json(revision.value, { headers: NO_STORE }) : errorResponse(revision.failure);
}

type ConfigSave = { text: string; sha: string; message: string };

/**
 * Narrows a save body to a config that reads, with a one-line commit subject.
 *
 * @example parseSave({ text: "{}", sha: "ab12", message: "docs: (studio) settings" }); // { ok: true, … }
 */
export function parseSave(body: unknown): Result<ConfigSave> {
  const { text, sha, message } = (body ?? {}) as Unparsed<ConfigSave>;

  if (typeof text !== "string" || typeof sha !== "string" || typeof message !== "string" || !message.trim()) {
    return { ok: false, failure: { status: 400, error: "Expected `text`, `sha` and `message` strings." } };
  }

  if (message.length > 200 || message.includes("\n")) {
    return { ok: false, failure: { status: 400, error: "The commit message has to be one short line." } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, failure: { status: 422, error: "The config is not valid JSON." } };
  }

  const checked = projectConfigSchema.safeParse(parsed);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, failure: { status: 422, error: `${where}${issue?.message ?? "The config does not read."}` } };
  }

  return { ok: true, value: { text, sha, message } };
}
