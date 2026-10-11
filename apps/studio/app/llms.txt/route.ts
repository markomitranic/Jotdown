import { llmsIndex } from "@jotdown/core/lib/llms";
import { currentProject } from "@/server/projects/context";
import { requireSource } from "@/lib/source";
import { markdownUrl } from "@/lib/markdown-url";

/** The open project's `/llms.txt`, which also tells an agent where the search API answers. */
export async function GET() {
  const project = await currentProject();
  if (!project) return new Response("No project is open.\n", { status: 404 });

  const text = llmsIndex(project, await requireSource(), (slugs) => markdownUrl(project.base, slugs), [
    `> Full-text search answers at ${project.base}/api/search?query=<words> as JSON.`,
  ]);
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const dynamic = "force-dynamic";
