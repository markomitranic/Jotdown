import { cache } from "react";
import { connection } from "next/server";
import { currentProject } from "@/server/projects/context";
import { projectSource } from "@jotdown/core/server/content";

/**
 * The page tree and page lookup of the project the switcher opened, or null when none is open.
 *
 * Compiled from the commit its branch is at, so every render asks for the
 * request first: the branch can move between two views of one address.
 */
export const getSource = cache(async () => {
  await connection();
  const project = await currentProject();
  return project ? projectSource(project) : null;
});

/** The project's pages, for the routes that cannot render without a project. */
export async function requireSource() {
  const source = await getSource();
  if (!source) throw new Error("No project is open.");
  return source;
}
