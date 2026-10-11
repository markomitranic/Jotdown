import type { z } from "zod";

/** A project file that could not be read, and why, in words the person fixing it can act on. */
export type FileProblem = { file: string; problem: string };

/**
 * Thrown for a file a project cannot open without, such as its config, naming the file.
 *
 * @example throw new BrokenFile(".jotdown/config.json", "title: Too small: expected string to have >=1 characters");
 */
export class BrokenFile extends Error {
  readonly file: string;
  readonly problem: string;

  constructor(file: string, problem: string) {
    super(`${file}: ${problem}`);
    this.name = "BrokenFile";
    this.file = file;
    this.problem = problem;
  }
}

/**
 * A JSON file's text checked against its schema, or what is wrong with it.
 *
 * @example readJsonFile(metaSchema, '{ "pages": ["index"] }'); // { ok: true, data: { pages: ["index"] } }
 * @example readJsonFile(metaSchema, "{ pages: [] }"); // { ok: false, problem: "Not valid JSON. …" }
 */
export function readJsonFile<Schema extends z.ZodType>(schema: Schema, text: string) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false as const, problem: `Not valid JSON. ${error instanceof Error ? error.message : ""}`.trim() };
  }

  const checked = schema.safeParse(json);
  return checked.success
    ? { ok: true as const, data: checked.data }
    : { ok: false as const, problem: describeIssues(checked.error) };
}

/**
 * A schema's complaints as one line per field, the field named first.
 *
 * @example describeIssues(error); // "title: Invalid input: expected string, received undefined"
 */
export function describeIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("\n");
}
