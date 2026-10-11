#!/usr/bin/env bun
/**
 * Lints docs pages and `meta.json` files, and exits 1 when any of them is broken.
 *
 * Give it files or folders, `docs` when given nothing. A folder is walked for
 * `.md`, `.mdx` and `meta.json`, skipping folders whose name starts with `_` or
 * `.`, which hold uploads rather than pages. Each problem prints as
 * `file:line:column  severity  message  rule`. Warnings alone exit 0.
 *
 * @example bun packages/lint/cli.ts
 * @example bun packages/lint/cli.ts docs/guides docs/index.mdx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LINT_RULES, lintFile } from "./lint";

const asked = process.argv.length > 2 ? process.argv.slice(2) : ["docs"];

const missing = asked.find((path) => !existsSync(path));
if (missing) {
  console.error(`${missing} does not exist. Give jotdown check the docs folder, or the files to lint.`);
  process.exit(2);
}

const files = asked.flatMap((path) => (statSync(path).isDirectory() ? docsIn(path) : [path]));
const problems = files.flatMap((file) =>
  lintFile(file, readFileSync(file, "utf8")).map((problem) => ({ file: relative(".", file), ...problem })),
);

for (const { file, line, column, message, rule } of problems) {
  console.error(`${file}:${line}:${column}  ${LINT_RULES[rule].padEnd(7)}  ${message.replaceAll("\n", "; ")}  ${rule}`);
}

const errors = problems.filter(({ rule }) => LINT_RULES[rule] === "error").length;
const warnings = problems.length - errors;

if (problems.length === 0) {
  console.log(`Checked ${count(files.length, "file")}, no problems.`);
  process.exit(0);
}

const found = [errors && count(errors, "error"), warnings && count(warnings, "warning")].filter(Boolean).join(" and ");
console.error(`\n${found} in ${count(files.length, "file")}.`);
process.exit(errors ? 1 : 0);

/**
 * Every page and `meta.json` under a folder, uploads and hidden folders left out.
 *
 * @example docsIn("docs"); // ["docs/index.mdx", "docs/meta.json", "docs/guides/setup.mdx"]
 */
function docsIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return /^[_.]|^node_modules$/.test(entry.name) ? [] : docsIn(path);
    return /\.mdx?$|^meta\.json$/.test(entry.name) ? [path] : [];
  });
}

/** @example count(2, "file"); // "2 files" */
function count(amount: number, noun: string) {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}
