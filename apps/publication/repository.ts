import { basename, dirname, resolve } from "node:path";

/**
 * The content repository a publication is built from: the one whose `.jotdown/` holds this checkout of Jotdown.
 *
 * A build clones Jotdown into `<repository>/.jotdown/framework` and runs the
 * app from its `apps/publication`, so where the app runs says which repository
 * it is. A checkout anywhere else is Jotdown's own repository, whose docs are a
 * project like any other.
 *
 * `JOTDOWN_PROJECT` names it outright, which is how `jotdown build` and
 * `jotdown dev` point one checkout at any project folder.
 *
 * @example contentRepository("/work/handbook/.jotdown/framework"); // "/work/handbook"
 * @example contentRepository("/work/jotdown"); // "/work/jotdown"
 */
export function contentRepository(framework = resolve(process.cwd(), "../..")) {
  if (process.env.JOTDOWN_PROJECT) return resolve(process.env.JOTDOWN_PROJECT);
  const holder = dirname(framework);
  return basename(holder) === ".jotdown" ? dirname(holder) : framework;
}
