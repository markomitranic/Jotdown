import { getSource } from "@/lib/source";
import { markdownUrl } from "@/lib/markdown-url";
import { currentProject } from "@/server/projects/context";
import { projectSearch } from "@jotdown/core/server/search";

/** Searches the open project on the server, at the commit its branch is at now, for agents and scripts. */
export async function GET(request: Request) {
  const project = await currentProject();
  const source = await getSource();
  if (!project || !source) return Response.json([]);
  return projectSearch(source, (slugs) => markdownUrl(project.base, slugs)).GET(request);
}

export const dynamic = "force-dynamic";
