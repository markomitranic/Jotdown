import type { StructureOp, StructureRequest, StructureResponse } from "@jotdown/editor/types";
import { MOVED_FILE, isDoc } from "@jotdown/core/lib/paths";
import { applyOps, type Move } from "./_structure";
import {
  errorResponse,
  jsonResponse,
  parseContentPath,
  parseFolderPath,
  parseOrderFolder,
  parseOrderNames,
  parsePerson,
  readJsonBody,
  type Result,
  type Unparsed,
} from "./_contract";
import { storage } from "../storage";

/**
 * Applies a queue of staged sidebar changes as one commit.
 *
 * `POST {apiBase}/structure` taking a `StructureRequest`. Creating a page,
 * making a section, moving one page into another and renaming a third all
 * arrive together and land together, because a reader rearranging a tree is
 * doing one thing, not six.
 *
 * The whole corpus is read, the queue is run against it in memory, and every
 * link that pointed at a page which moved is repaired before anything is
 * committed. A link to a page the queue deletes is unwritten instead, back to
 * the words it was spelt as. Neither is a nicety: a link whose target is gone
 * renders with the href exactly as typed and 404s on the click, silently.
 *
 * Refusals come back as a **422** listing which staged change was impossible and
 * why, so the sidebar can mark that one row rather than throwing the queue away.
 * A page moving underneath a queue built before it is a **409**.
 */
export async function POST(request: Request) {
  const parsed = parseStructureRequest(await readJsonBody(request));
  if (!parsed.ok) return errorResponse(parsed.failure);
  const { ops, author } = parsed.value;

  const docs = await storage.readDocs();
  if (!docs.ok) return errorResponse(docs.failure);

  const applied = applyOps(docs.value.corpus, ops);
  if (!applied.ok) {
    return errorResponse({
      status: 422,
      error: applied.refusals.map(({ reason }) => reason).join(" "),
      refusals: applied.refusals,
    });
  }

  const { additions, deletions, moves } = applied.plan;

  if (additions.length === 0 && deletions.length === 0) {
    return errorResponse({ status: 422, error: "Nothing in this queue changes anything." });
  }

  const forwarding = await recordMoves(moves);
  if (!forwarding.ok) return errorResponse(forwarding.failure);

  const committed = await storage.commitTree({
    message: `docs: (studio) ${describe(ops)}`,
    additions: [...additions.map(({ path, content }) => ({ path, content })), ...forwarding.value],
    deletions,
    author,
    expectedHead: docs.value.head,
  });
  if (!committed.ok) return errorResponse(committed.failure);

  if (committed.value.moved) {
    return errorResponse({
      status: 409,
      error:
        "Somebody changed the project while this was being saved. Your staged changes are still here, so reload the page and try again.",
    });
  }

  const answer: StructureResponse = {
    commitSha: committed.value.commitSha,
    changed: additions.length + deletions.length,
    moves,
  };

  return jsonResponse(answer);
}

/**
 * Appends this queue's moves to the forwarding record, or writes nothing.
 *
 * `docs/moved.json` is read by `next.config.ts` at build time and turned
 * into redirects, so a link somebody posted in Slack last month still lands on
 * the page. It is also what lets a save follow a page that moved while it was
 * being written, which is why deletions go in it too, as a `to` of null.
 */
async function recordMoves(moves: Move[]): Promise<Result<{ path: string; content: string }[]>> {
  if (moves.length === 0) return { ok: true, value: [] };

  const existing = await storage.readSource(MOVED_FILE);
  const before = existing.ok ? parseMoves(existing.value.text) : [];

  if (!existing.ok && existing.failure.status !== 404) return existing;

  const after = [...before.filter(({ from }) => !moves.some((move) => move.from === from)), ...moves];

  return {
    ok: true,
    value: [{ path: MOVED_FILE, content: `${JSON.stringify(after, null, 2)}\n` }],
  };
}

/** A record that will not parse is treated as empty, never as a reason to refuse. */
function parseMoves(text: string): Move[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Move[]) : [];
  } catch {
    return [];
  }
}

/**
 * Names the commit after what the queue did, in the plainest terms available.
 *
 * @example describe([{ kind: "delete", path: "guides/old" }]); // "delete guides/old"
 */
function describe(ops: StructureOp[]) {
  const [op] = ops;
  if (ops.length === 1 && op) {
    if (op.kind === "create") return `add ${op.title}`;
    if (op.kind === "nest") return `make room for pages inside ${op.path}`;
    if (op.kind === "delete") return `delete ${op.path}`;
    if (op.kind === "reorder") return `reorder ${op.folder}`;
    if (op.kind === "rename") return `rename ${op.path} to ${op.title}`;
    if (op.kind === "renameSection") return `rename the ${op.path} section to ${op.label}`;
    if (op.kind === "moveSection") return `move the ${op.from} section to ${op.to}`;
    if (op.kind === "icon") return `change the icon of ${op.path}`;
    if (op.kind === "defaultOpen") return `${op.open ? "open" : "fold"} ${op.path} by default`;
    return `move ${op.from} to ${op.to}`;
  }

  return `rearrange ${ops.length} things in the docs`;
}

/**
 * Narrows an untrusted body to a queue of ops with paths we are willing to write.
 *
 * Every path goes through the same allowlist the save endpoint uses, so no op
 * can reach a file outside `docs/`. A section arrives as a folder, which needs
 * the folder rule rather than the file one.
 */
function parseStructureRequest(body: unknown): Result<StructureRequest> {
  const { ops, author } = (body ?? {}) as Unparsed<StructureRequest>;

  if (!Array.isArray(ops) || ops.length === 0) {
    return { ok: false, failure: { status: 400, error: "Expected at least one change." } };
  }

  const writer = parsePerson(author);
  if (!writer.ok) return writer;

  const parsed: StructureOp[] = [];
  for (const raw of ops) {
    const op = parseOp(raw);
    if (!op.ok) return op;
    parsed.push(op.value);
  }

  return { ok: true, value: { ops: parsed, author: writer.value } };
}

/** True for a Lucide component name, `BookOpen`, or for no icon at all. */
function isIcon(icon: string | null) {
  return icon === null || /^[A-Z][A-Za-z0-9]*$/.test(icon);
}

function parseOp(raw: unknown): Result<StructureOp> {
  const op = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof op[key] === "string" ? (op[key] as string) : null);
  const rejected: Result<StructureOp> = {
    ok: false,
    failure: { status: 400, error: `${String(op.kind)} is not a change this endpoint can make.` },
  };

  switch (op.kind) {
    case "create": {
      const path = parseContentPath(text("path"));
      const title = text("title");
      if (!path.ok) return path;
      if (!title) return rejected;
      if (!isIcon(text("icon"))) return rejected;
      return {
        ok: true,
        value: { kind: "create", path: path.value, title, description: text("description"), icon: text("icon") },
      };
    }

    case "nest": {
      const path = parseContentPath(text("path"));
      if (!path.ok) return path;
      return { ok: true, value: { kind: "nest", path: path.value } };
    }

    case "rename": {
      const path = parseContentPath(text("path"));
      const title = text("title");
      if (!path.ok) return path;
      if (!title) return rejected;
      return { ok: true, value: { kind: "rename", path: path.value, title } };
    }

    case "renameSection": {
      const path = parseFolderPath(text("path"));
      const label = text("label");
      if (!path.ok) return path;
      if (!label) return rejected;
      return { ok: true, value: { kind: "renameSection", path: path.value, label } };
    }

    case "moveSection": {
      const from = parseFolderPath(text("from"));
      const to = parseFolderPath(text("to"));
      if (!from.ok) return from;
      if (!to.ok) return to;
      return { ok: true, value: { kind: "moveSection", from: from.value, to: to.value } };
    }

    case "move": {
      const from = parseContentPath(text("from"));
      const to = parseContentPath(text("to"));
      if (!from.ok) return from;
      if (!to.ok) return to;
      return { ok: true, value: { kind: "move", from: from.value, to: to.value } };
    }

    case "delete": {
      const path = parseContentPath(text("path"));
      if (!path.ok) return path;
      return { ok: true, value: { kind: "delete", path: path.value } };
    }

    case "icon": {
      const named = text("path");
      const path = isDoc(named ?? "") ? parseContentPath(named) : parseFolderPath(named);
      const icon = text("icon");
      if (!path.ok) return path;
      if (!isIcon(icon)) return rejected;
      return { ok: true, value: { kind: "icon", path: path.value, icon } };
    }

    case "defaultOpen": {
      const path = parseFolderPath(text("path"));
      if (!path.ok) return path;
      if (typeof op.open !== "boolean") return rejected;
      return { ok: true, value: { kind: "defaultOpen", path: path.value, open: op.open } };
    }

    case "reorder": {
      const folder = parseOrderFolder(text("folder"));
      const names = parseOrderNames(op.names);
      if (!folder.ok) return folder;
      if (!names.ok) return names;
      return { ok: true, value: { kind: "reorder", folder: folder.value, names: names.value } };
    }

    default:
      return rejected;
  }
}
