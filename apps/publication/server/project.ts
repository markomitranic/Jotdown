import { resolve } from "node:path";
import { cache } from "react";
import { contentRepository } from "@/repository";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import { projectSource, sourceProblems } from "@jotdown/core/server/content";

/**
 * The content repository this publication is built from, served at the site's root.
 *
 * The repository is the one this checkout of Jotdown was cloned into, and its
 * `.jotdown/config.json` names the folder holding `docs/` when that is not the
 * repository itself, and the address it is hosted at. A built site reads the
 * copy of it the build took into `.content/`, which its server functions carry.
 *
 * @example publication(); // { id: "publication", base: "", directory: "/work/handbook", … }
 */
export const publication = cache(() => {
  const repository = process.env.NODE_ENV === "production" ? resolve(process.cwd(), ".content") : contentRepository();
  return {
    id: "publication",
    base: "",
    directory: contentDirectory(repository),
    config: readProjectConfig(repository),
  };
});

/**
 * The publication's pages, compiled from the content repository.
 *
 * Any file that could not be read stops whatever is drawing from it, the build
 * or a first visit, every one of them named, so a reader never gets a site
 * with a page or a section missing.
 */
export const publicationSource = cache(async () => {
  const source = await projectSource(publication());
  const problems = sourceProblems(source);
  if (problems.length)
    throw new Error(
      `This publication cannot be built until these files are fixed:\n\n${problems.map(({ file, problem }) => `${file}\n${problem}`).join("\n\n")}`,
    );
  return source;
});
