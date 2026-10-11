import { cache } from "react";
import { contentRepository } from "@/repository";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import { siteBase } from "./base";
import { projectSource, sourceProblems } from "@jotdown/core/server/content";

/**
 * The content repository this publication is built from, served at the site's base path.
 *
 * Its pages are written as at the root, since the router adds the base path to
 * every link, and its files carry the base path themselves.
 *
 * The repository is the one this checkout of Jotdown was cloned into, and its
 * `.jotdown/config.json` names the folder holding `docs/` when that is not the
 * repository itself, and the address it is hosted at.
 *
 * @example publication(); // { id: "publication", base: "", directory: "/work/handbook", … }
 */
export const publication = cache(() => {
  const repository = contentRepository();
  return {
    id: "publication",
    base: "",
    assetBase: siteBase(repository),
    directory: contentDirectory(repository),
    config: readProjectConfig(repository),
  };
});

/**
 * The publication's pages, compiled from the content repository.
 *
 * Any file that could not be read stops the build, every one of them named,
 * so a reader never gets a site with a page or a section missing.
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
