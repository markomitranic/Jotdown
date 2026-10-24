#!/usr/bin/env bun
/**
 * The Jotdown command line, run in a project's folder or pointed at one.
 *
 * `jotdown check` lints docs pages without starting anything: front matter,
 * MDX, code a page may not run, and the house style. It exits 1 when a page is
 * broken. `jotdown dev` serves the site while its files change, and `jotdown add`
 * copies one of the framework's blocks or layouts into the project to change.
 *
 * @example jotdown check docs/guides docs/index.mdx
 * @example jotdown add block Hero
 * @example jotdown dev ~/Sites/notes --port 4000
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const USAGE = `Usage: jotdown <command> [...]

  check [<path>...]          lint the pages in the files or folders given, docs by
                             default, and exit 1 when one is broken
  dev [<project>] [--port n] serve the project's site, rebuilt as its files change
  add block|layout [<name>]  copy one of the framework's blocks or layouts into this
                             project's .jotdown to change, or list them

<project> is a folder holding .jotdown/config.json, this one by default.`;

const framework = resolve(import.meta.dirname, "..");
const [command, ...rest] = process.argv.slice(2);

if (!command || command === "-h" || command === "--help" || rest.includes("-h") || rest.includes("--help"))
  exit(USAGE, command ? 0 : 1);

if (command === "check") await run("bun", [join(framework, "packages/lint/cli.ts"), ...rest]);
if (command === "dev") {
  const at = rest.indexOf("--port");
  const port = at === -1 ? "6193" : rest[at + 1];
  const folder = rest.find((arg, index) => !arg.startsWith("--") && index !== at + 1);
  await run(
    "bun",
    ["run", "--bun", "next", "dev", "-p", port ?? "6193"],
    project(folder),
    join(framework, "apps/publication"),
  );
}
if (command === "add") add(rest[0], rest[1]);
exit(USAGE, 1);

/**
 * Copies a block or a layout the framework ships into the project, or lists what there is.
 *
 * A file the project already has is left alone, since it is the project's own now.
 *
 * @example add("block", "Hero"); // writes .jotdown/components/Hero.tsx
 */
function add(kind: string | undefined, name: string | undefined): never {
  const folders = { block: "blocks", layout: "layouts" } as const;
  if (kind !== "block" && kind !== "layout") exit(USAGE, 1);

  const templates = join(framework, "packages/kit/templates", folders[kind]);
  const names = readdirSync(templates).map((file) => basename(file, extname(file)));
  if (!name) exit(`Available ${kind}s: ${names.join(", ")}`, 0);
  if (!names.includes(name)) exit(`There is no ${kind} called ${name}. Available: ${names.join(", ")}`, 1);

  const into = resolve(".jotdown", kind === "block" ? "components" : "layouts");
  const file = join(into, `${name}.tsx`);
  if (existsSync(file)) exit(`${file} already exists, and it is yours to change.`, 1);

  mkdirSync(into, { recursive: true });
  copyFileSync(join(templates, `${name}.tsx`), file);
  exit(`Added ${file}.`, 0);
}

/**
 * The environment that points the publication at a project folder.
 *
 * @example project("~/Sites/notes"); // { JOTDOWN_PROJECT: "/Users/ada/Sites/notes" }
 */
function project(folder = ".") {
  return { JOTDOWN_PROJECT: resolve(folder) };
}

/** Runs one command to its end with the terminal attached, from the folder given or this one, and exits with its code. */
async function run(
  command: string,
  args: string[],
  env: Record<string, string> = {},
  cwd = process.cwd(),
): Promise<never> {
  const child = spawn(command, args, {
    stdio: "inherit",
    cwd,
    env: { ...process.env, ...env },
  });
  const [code] = await once(child, "exit");
  process.exit(code ?? 1);
}

function exit(message: string, code: number): never {
  (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}
