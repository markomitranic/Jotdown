import { posix } from "node:path";
import { CONFIG_FILE } from "@jotdown/core/server/config";
import { UPLOADS_FOLDER } from "@jotdown/core/lib/paths";
import { PALETTES, type Inspection, type PlannedFile, type SetupAnswers } from "../../lib/setup";
import type { Move } from "./content";
import type { FrameworkFile } from "./framework";
import { homePage, mainMeta, starterPages } from "./pages";

/**
 * Everything the wizard writes into a project, worked out from the answers alone.
 *
 * Paths are from the repository root. What is in the content folder's way is
 * moved into `_old/` first, as the answers chose. A file already there is kept,
 * never overwritten, except the docs skills, which are replaced with this
 * studio's copy the way `npx skills add` replaces them, and the agent
 * instructions, which get the note added at the end. A file standing where the
 * plan needs a folder, such as a skill folder that is a link, is deleted first.
 */

/** One change: a file to write as text or bytes, a symlink, a file or folder moved here `from` elsewhere, or one deleted. */
export type Write = { path: string; change: PlannedFile["change"] } & (
  | { content: string | Uint8Array }
  | { link: string }
  | { from: string }
  | { remove: true }
);

/** What a plan is made from besides the answers: the framework's files, the icon, and what the repository already holds. */
export type Sources = {
  skills: FrameworkFile[];
  deployment: FrameworkFile[];
  icon: Uint8Array | null;
  /** The agent instructions files the repository has, with their text. */
  notes: Partial<Record<"AGENTS.md" | "CLAUDE.md", string>>;
  existing: Set<string>;
  /** The folders the plan writes into that are files or links in the repository instead. */
  standing: Set<string>;
  /** What is moved out of the content folder's way. */
  moves: Move[];
};

const SKILLS_COMMAND = "npx skills add markomitranic/Jotdown --skill '*' -y";

/**
 * Every write a setup makes, in the order a reviewer reads them: the config, the pages, the uploads, then the agents' and hosts' files.
 *
 * @example planSetup(answers, inspection, sources); // [{ path: ".jotdown/config.json", change: "new", content: "{…}" }, …]
 */
export function planSetup(answers: SetupAnswers, inspection: Inspection, sources: Sources): Write[] {
  const inContent = (path: string) => (answers.content ? `${answers.content}/${path}` : path);
  const starter = answers.pages === "starter";

  const pages: Record<string, string> = {
    "index.mdx": homePage(answers.title, answers.description, starter),
    "meta.json": mainMeta(answers.title, starter),
    ...(starter ? starterPages() : {}),
  };

  const { moves } = sources;
  const deletions = [...sources.standing].filter(
    (path) => ![...sources.standing].some((other) => path.startsWith(`${other}/`)),
  );
  const cleared = [...moves.map((move) => move.from), ...deletions];
  const gone = (path: string) => cleared.some((node) => path === node || path.startsWith(`${node}/`));
  const arrived = (path: string) => moves.some((move) => path === move.to || path.startsWith(`${move.to}/`));
  const there = (path: string) => arrived(path) || (sources.existing.has(path) && !gone(path));
  const notes = Object.fromEntries(Object.entries(sources.notes).filter(([file]) => !gone(file)));

  const writes: Write[] = [
    ...moves.map((move): Write => ({ path: move.to, change: "moved", from: move.from })),
    ...deletions.map((path): Write => ({ path, change: "deleted", remove: true })),
    { path: CONFIG_FILE, change: "new", content: projectConfig(answers, inspection) },
    ...Object.entries(pages).map(
      ([path, content]): Write => ({ path: inContent(`docs/${path}`), change: "new", content }),
    ),
    ...(sources.icon
      ? [{ path: inContent(`${UPLOADS_FOLDER}/icon.png`), change: "new", content: sources.icon } satisfies Write]
      : []),
    ...(answers.skills ? skillWrites(sources.skills) : []),
    ...(answers.agentNote ? noteWrites(answers.content, notes) : []),
    ...sources.deployment.map((file): Write => ({ path: file.path, change: "new", content: file.content })),
  ];

  const rewritten = new Set(writes.flatMap((write) => ("content" in write || "link" in write ? [write.path] : [])));

  return writes
    .filter((write) => !(write.change === "deleted" && rewritten.has(write.path)))
    .map((write): Write => {
      if (write.change !== "new" || "from" in write) return write;
      if (deletions.includes(write.path)) return { ...write, change: "replaced" };
      return there(write.path) ? keptOrReplaced(write) : write;
    })
    .filter((write) => !(write.change === "kept" && arrived(write.path)));
}

/**
 * The files a plan would touch, to ask the repository which of them exist before planning for real.
 *
 * @example plannedPaths(answers, inspection, sources); // [".jotdown/config.json", "docs/index.mdx", …]
 */
export function plannedPaths(
  answers: SetupAnswers,
  inspection: Inspection,
  sources: Omit<Sources, "existing" | "notes" | "standing">,
) {
  return planSetup(answers, inspection, { ...sources, notes: {}, existing: new Set(), standing: new Set() })
    .filter((write) => "content" in write || "link" in write)
    .map((write) => write.path);
}

/**
 * Every folder the planned files land in, to ask the repository whether a file stands where one must go.
 *
 * @example plannedFolders([".agents/skills/blocks/SKILL.md", "AGENTS.md"]); // [".agents", ".agents/skills", ".agents/skills/blocks"]
 */
export function plannedFolders(paths: string[]) {
  const folders = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth++) folders.add(parts.slice(0, depth).join("/"));
  }
  return [...folders];
}

/**
 * A plan as the review step lists it: each path and what happens to it.
 *
 * @example summarise(writes); // [{ path: ".jotdown/config.json", change: "new" }, …]
 */
export function summarise(writes: Write[]): PlannedFile[] {
  return writes.map((write) => ({
    path: write.path,
    change: write.change,
    ...("from" in write && { from: write.from }),
  }));
}

/** The writes that change the repository, leaving out what is kept as it is. */
export function changes(writes: Write[]) {
  return writes.filter((write) => write.change !== "kept");
}

/**
 * The project's `.jotdown/config.json`, naming only what differs from the defaults.
 *
 * Neutral writes no theme, since it is the framework's own palette.
 *
 * @example projectConfig(answers, inspection); // "{\n  \"version\": 3,\n  \"title\": \"Checkout\"…"
 */
function projectConfig(answers: SetupAnswers, inspection: Inspection) {
  const palette = answers.palette === "neutral" ? null : PALETTES.find((each) => each.id === answers.palette);
  const icon = "/uploads/icon.png";

  const config = {
    version: 1,
    title: answers.title,
    ...(answers.description && { description: answers.description }),
    ...(inspection.repository && { repository: inspection.repository }),
    ...(answers.url && { url: answers.url }),
    ...(answers.content && { content: answers.content }),
    ...(answers.icon && { logo: { alt: answers.title, src: icon }, favicon: icon }),
    ...(palette && { theme: { light: palette.light, dark: palette.dark } }),
    ...(!(answers.llms && answers.assistants) && {
      features: {
        ...(!answers.llms && { llms: false }),
        ...(!answers.assistants && { assistants: false }),
      },
    }),
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * The docs skills in `.agents/skills/`, each file linked into `.claude/skills/` for Claude Code.
 *
 * One link per file rather than one for the folder, since a folder link is what
 * pnpm cannot install from a git repository.
 */
function skillWrites(skills: FrameworkFile[]): Write[] {
  return skills.flatMap(({ path, content }): Write[] => {
    const link = path.replace(/^\.agents\//, ".claude/");
    return [
      { path, change: "new", content },
      { path: link, change: "new", link: posix.relative(posix.dirname(link), path) },
    ];
  });
}

/**
 * The note telling agents where the docs are, added to the instructions the repository has, or a new `AGENTS.md` that Claude Code imports.
 *
 * A file that already names the skills command has had the note, and is kept.
 */
function noteWrites(content: string, notes: Sources["notes"]): Write[] {
  const note = agentNote(content);
  const file = notes["AGENTS.md"] !== undefined ? "AGENTS.md" : notes["CLAUDE.md"] !== undefined ? "CLAUDE.md" : null;

  if (!file) {
    return [
      { path: "AGENTS.md", change: "new", content: `# Agents\n\n${note}` },
      { path: "CLAUDE.md", change: "new", content: "@AGENTS.md\n" },
    ];
  }

  const text = notes[file] ?? "";
  if (text.includes(SKILLS_COMMAND)) return [{ path: file, change: "kept", content: text }];
  return [{ path: file, change: "appended", content: `${text.trimEnd()}\n\n${note}` }];
}

/**
 * The section of agent instructions that points at the docs and the skills that write them.
 *
 * @example agentNote("apps/docs"); // "## Documentation\n\nThis project's documentation lives in `apps/docs/docs`…"
 */
export function agentNote(content: string) {
  const docs = content ? `${content}/docs` : "docs";

  return `## Documentation

This project's documentation lives in \`${docs}\`, written with Jotdown, and is updated in the same change as the code it describes. Before writing or editing a page, run \`${SKILLS_COMMAND}\` to refresh the docs skills, then read \`.agents/skills/authoring/SKILL.md\`. To review a page before committing, open the project in Jotdown.
`;
}

/** A write whose path exists already: skills are replaced with this studio's copy, anything else is left alone. */
function keptOrReplaced(write: Write): Write {
  const skill = write.path.startsWith(".agents/skills/") || write.path.startsWith(".claude/skills/");
  return { ...write, change: skill ? "replaced" : "kept" };
}
