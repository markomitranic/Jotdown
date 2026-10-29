import { notFound } from "next/navigation";
import { llmsIndex } from "@jotdown/core/lib/llms";
import { markdownUrl } from "@/lib/markdown-url";
import { publication, publicationSource } from "@/server/project";

/** The publication's `/llms.txt`, written at build time, or a 404 when the config switches it off. */
export async function GET() {
  const project = publication();
  if (!project.config.features.llms) notFound();

  const text = llmsIndex(project, await publicationSource(), markdownUrl);
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const dynamic = "force-static";
