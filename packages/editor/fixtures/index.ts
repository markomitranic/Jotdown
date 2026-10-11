/**
 * The documents the editor's round-trip tests run against, read from this folder.
 *
 * Each is a page shaped the way a real site's pages are: one of every block,
 * and a changelog a release tool wrote. They live here,
 * inside the framework, so the tests pass in every instance and in the template
 * whatever that site's `docs/` folder holds.
 *
 * @example fixtures.map((f) => f.name); // ["changelog.md", "every-block.mdx", ...]
 */

import fs from "node:fs";
import path from "node:path";

const dir = import.meta.dirname;

export const fixtures = fs
  .readdirSync(dir)
  .filter((name) => /\.mdx?$/.test(name))
  .map((name) => ({ name, source: fs.readFileSync(path.join(dir, name), "utf8") }));
