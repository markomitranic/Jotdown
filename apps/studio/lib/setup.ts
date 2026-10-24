import { z } from "zod";

/**
 * What the setup wizard asks, shared by the wizard and the server that carries it out.
 *
 * Everything the wizard writes follows from these answers alone, so the review
 * step shows exactly what Create will write, and running it twice writes the
 * same files.
 */

/** Where a new project goes: a GitHub repository, or a folder on this machine in a local studio. */
export const setupTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("github"),
    key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/),
  }),
  z.object({ kind: z.literal("folder"), path: z.string().min(1) }),
]);

export type SetupTarget = z.infer<typeof setupTargetSchema>;

/** The folder holding `docs/`, empty for the repository root. */
const contentFolder = z.union([
  z.literal(""),
  z
    .string()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
      "Name a folder inside the repository, like apps/docs.",
    ),
]);

/** Every answer the wizard collects. The icon is a square PNG, base64, already drawn at 512 pixels. */
export const setupAnswersSchema = z.object({
  target: setupTargetSchema,
  content: contentFolder,
  title: z.string().trim().min(1, "Give the docs a title."),
  description: z.string().trim(),
  url: z.union([z.literal(""), z.string().url("Write the address in full, with https://.")]),
  palette: z.enum(["neutral", "iris", "ocean", "forest", "ember", "graphite"]),
  icon: z.string().max(1_400_000).nullable(),
  pages: z.enum(["home", "starter"]),
  skills: z.boolean(),
  agentNote: z.boolean(),
  publishing: z.enum(["none", "vercel"]),
  /** Move what the content folder already holds into `_old/` inside it, so docs can be set up there. */
  moveOld: z.boolean(),
});

export type SetupAnswers = z.infer<typeof setupAnswersSchema>;

/** What the server found at a target before anything is written. */
export type Inspection = {
  target: SetupTarget;
  /** The target as people read it: `you/site`, or `~/Sites/web`. */
  name: string;
  title: string;
  description: string;
  /** The default branch, which the studio reads, or null for a folder outside git. */
  branch: string | null;
  repository: string | null;
  /** The agent instructions file the note would go into, when the repository has one. */
  agentFile: "AGENTS.md" | "CLAUDE.md" | null;
  /** Why the wizard cannot set up here, or null when it can. */
  problem: Problem | null;
};

/** A reason the target cannot be set up, with what fixes it. */
export type Problem =
  | { kind: "configured"; message: string; open: string }
  | { kind: "unreachable"; message: string }
  | { kind: "readonly"; message: string }
  | { kind: "empty"; message: string };

/** One file Create writes, and whether it is new, added to, replaced with the framework's newer copy, or left alone because it exists. */
export type PlannedFile = {
  path: string;
  change: "new" | "appended" | "replaced" | "kept" | "moved" | "deleted";
  from?: string;
};

/**
 * What the chosen content folder already holds: nothing that is in the way, or files that are.
 *
 * At the repository root only `docs/` is in the way, since a root always holds code.
 * `entries` names what is in the way, the first few of it, and `count` how many
 * there are.
 */
export type ContentState = { kind: "clear" } | { kind: "occupied"; entries: string[]; count: number };

/** The folder that already-present content moves into, inside the content folder. */
export const OLD_FOLDER = "_old";

/** One mode of a palette's core colours. */
export type Mode = { background: string; foreground: string; primary: string };

/** Where the files land: a folder on this machine, or a repository's default branch, committed as the editor. */
export type Destination = { kind: "folder"; name: string } | { kind: "github"; branch: string; editor: string };

/** What the dry run answers: every file, and where they land. */
export type SetupPlan = { files: PlannedFile[]; destination: Destination };

/** What Create answers: the project's key, to open it, its title, and every file written. */
export type SetupDone = { key: string; title: string; files: PlannedFile[] };

/** A starting palette: its name, and the three core colours of each mode. Neutral is the framework's own, and writes no theme. */
export type Palette = { id: SetupAnswers["palette"]; name: string; light: Mode; dark: Mode };

export const PALETTES: [Palette, ...Palette[]] = [
  {
    id: "neutral",
    name: "Neutral",
    light: { background: "#ffffff", foreground: "#09090b", primary: "#18181b" },
    dark: { background: "#09090b", foreground: "#fafafa", primary: "#fafafa" },
  },
  {
    id: "iris",
    name: "Iris",
    light: { background: "#ffffff", foreground: "#1c1a33", primary: "#433a86" },
    dark: { background: "#0d0c1b", foreground: "#ecebf5", primary: "#b9acff" },
  },
  {
    id: "ocean",
    name: "Ocean",
    light: { background: "#ffffff", foreground: "#0f1b2d", primary: "#1f5fbf" },
    dark: { background: "#0a1220", foreground: "#e3eaf5", primary: "#7fb2ff" },
  },
  {
    id: "forest",
    name: "Forest",
    light: { background: "#fbfcfa", foreground: "#17231b", primary: "#2f6f4a" },
    dark: { background: "#0d1510", foreground: "#e2ece5", primary: "#7fd1a0" },
  },
  {
    id: "ember",
    name: "Ember",
    light: { background: "#fffcf8", foreground: "#2a1d14", primary: "#b4481b" },
    dark: { background: "#17100b", foreground: "#f1e6dc", primary: "#ffab73" },
  },
  {
    id: "graphite",
    name: "Graphite",
    light: { background: "#ffffff", foreground: "#18181b", primary: "#18181b" },
    dark: { background: "#000000", foreground: "#fafafa", primary: "#fafafa" },
  },
];

/** The pages the starter set adds beside the home page, as the wizard lists them. */
export const STARTER_PAGES = [
  { path: "getting-started/index.mdx", title: "Getting started" },
  { path: "architecture/index.mdx", title: "Architecture" },
  { path: "decision-records/index.mdx", title: "Decision records" },
  { path: "decision-records/0001-record-architecture-decisions.mdx", title: "ADR 0001: Record architecture decisions" },
];
